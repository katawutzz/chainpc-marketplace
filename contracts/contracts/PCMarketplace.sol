// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {AccessControlEnumerable} from "@openzeppelin/contracts/access/extensions/AccessControlEnumerable.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title ChainPC – Decentralized PC Marketplace
 * @notice ตลาดซื้อขายคอมพิวเตอร์และอุปกรณ์ IT แบบ Escrow บน Ethereum Hoodi Testnet
 *
 * - ใครก็ลงขายได้ ผู้ซื้อจ่าย ETH ผ่าน MetaMask แล้วเงินถูกล็อกไว้ใน contract
 * - ผู้ขายแจ้งจัดส่ง → ผู้ซื้อยืนยันรับของ → เงินปลดให้ผู้ขาย (หักค่าธรรมเนียม)
 * - ผู้ขายไม่ส่งของตามกำหนด → ผู้ซื้อขอเงินคืนได้
 * - ผู้ซื้อเงียบเกินกำหนด → ผู้ขายรับเงินเองได้
 * - มีข้อพิพาท → Admin ตัดสิน
 * - เงินทุกก้อนใช้รูปแบบ Pull Payment: บันทึกยอดไว้ แล้วเจ้าของกด withdraw() เอง
 *
 * สิทธิ์ (OpenZeppelin AccessControlEnumerable — มี Admin ได้หลายคน):
 * - ADMIN_ROLE          ดูแลระบบ: ซ่อนสินค้า แบน/Verified ตัดสินข้อพิพาท ตั้งค่า pause ถอนค่าธรรมเนียม
 * - DEFAULT_ADMIN_ROLE  เพิ่ม/ถอด Admin (grantRole / revokeRole) — ผู้ deploy ได้ทั้งสอง role
 *
 * ข้อความยาว (รายละเอียดสินค้า, เหตุผลข้อพิพาท) เก็บใน Supabase
 * บน chain เก็บแค่ keccak256 hash ไว้ตรวจสอบว่าข้อมูลไม่ถูกแก้ไข
 * (รีวิวเก็บใน Supabase ทั้งหมด — ดู docs/SCOPE.md ข้อ 8)
 */
contract PCMarketplace is AccessControlEnumerable, Pausable, ReentrancyGuard {
    // ───────────────────────────── Types ─────────────────────────────

    enum Category {
        BuiltPC, // 0 PC ประกอบ
        CPU, // 1
        GPU, // 2 GPU / การ์ดจอ
        RAM, // 3
        SSD, // 4
        Mainboard, // 5
        Monitor, // 6
        KeyboardMouse, // 7 Keyboard / Mouse
        Headset // 8 Gaming Headset
    }

    enum Condition {
        New, // 0 มือหนึ่ง
        Used // 1 มือสอง
    }

    enum OrderStatus {
        None, // 0 ไม่มีคำสั่งซื้อนี้
        Paid, // 1 จ่ายแล้ว เงินล็อกใน contract รอผู้ขายจัดส่ง
        Shipped, // 2 จัดส่งแล้ว รอผู้ซื้อยืนยัน
        Disputed, // 3 มีข้อพิพาท รอ Admin ตัดสิน
        Completed, // 4 สำเร็จ เงินไปที่ผู้ขาย
        Refunded // 5 คืนเงินผู้ซื้อแล้ว
    }

    struct Product {
        uint256 id;
        address seller;
        string title;
        Category category;
        Condition condition;
        uint256 price; // ราคาต่อชิ้น (wei)
        uint32 stock;
        bool active; // ผู้ขายเปิด/ปิดการขาย
        bool hidden; // Admin ซ่อน
        bytes32 detailsHash; // hash ของรายละเอียดใน Supabase
        uint64 createdAt;
        uint64 updatedAt;
    }

    struct Order {
        uint256 id;
        uint256 productId;
        address buyer;
        address seller;
        uint32 quantity;
        uint256 unitPrice; // ราคา ณ ตอนจ่าย (แก้ราคาภายหลังไม่กระทบ)
        uint256 total;
        uint16 feeBps; // ค่าธรรมเนียม ณ ตอนจ่าย
        uint32 confirmWindow; // ระยะเวลายืนยันรับของ ณ ตอนจ่าย (วินาที)
        OrderStatus status;
        uint64 paidAt;
        uint64 shipDeadline; // ผู้ขายต้องแจ้งจัดส่งก่อนเวลานี้
        uint64 shippedAt;
        uint64 confirmDeadline; // ผู้ซื้อต้องยืนยัน/เปิดข้อพิพาทก่อนเวลานี้
        string trackingNo;
        bytes32 disputeReasonHash;
    }

    struct SellerInfo {
        bool verified;
        bool banned;
    }

    // ─────────────────────────── Constants ───────────────────────────

    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    uint16 public constant MAX_FEE_BPS = 1_000; // สูงสุด 10%
    uint16 public constant BPS_DENOMINATOR = 10_000;
    uint256 public constant MAX_CART_ITEMS = 20;
    uint256 public constant MAX_TITLE_LENGTH = 100; // bytes
    uint256 public constant MAX_TRACKING_LENGTH = 64; // bytes
    uint256 public constant MAX_NOTE_LENGTH = 280; // bytes
    uint32 public constant MAX_WINDOW = 30 days;

    // ──────────────────────────── Storage ────────────────────────────

    uint16 public feeBps;
    uint32 public shipWindow; // วินาที
    uint32 public confirmWindow; // วินาที

    uint256 public productCount;
    uint256 public orderCount;
    uint256 public accumulatedFees; // ค่าธรรมเนียมที่ Admin ยังไม่ถอน
    uint256 public totalEscrow; // เงินที่ยังล็อกอยู่ในคำสั่งซื้อที่ยังไม่จบ

    mapping(uint256 => Product) private _products; // id เริ่มที่ 1
    mapping(uint256 => Order) private _orders; // id เริ่มที่ 1
    mapping(address => SellerInfo) private _sellers;
    mapping(address => uint256) public pendingWithdrawals;

    // ──────────────────────────── Events ─────────────────────────────

    event ProductListed(
        uint256 indexed productId,
        address indexed seller,
        string title,
        Category category,
        Condition condition,
        uint256 price,
        uint32 stock,
        bytes32 detailsHash
    );
    event ProductUpdated(uint256 indexed productId, uint256 price, uint32 stock, bytes32 detailsHash);
    event ProductActiveChanged(uint256 indexed productId, bool active);
    event ProductHidden(uint256 indexed productId, bool hidden);

    event OrderPlaced(
        uint256 indexed orderId,
        uint256 indexed productId,
        address indexed buyer,
        address seller,
        uint32 quantity,
        uint256 unitPrice,
        uint256 total,
        uint16 feeBps,
        uint64 shipDeadline
    );
    event OrderShipped(uint256 indexed orderId, string trackingNo, uint64 confirmDeadline);
    event OrderCompleted(uint256 indexed orderId, uint256 sellerAmount, uint256 fee);
    event OrderRefunded(uint256 indexed orderId, uint256 amount);
    event DisputeOpened(uint256 indexed orderId, bytes32 reasonHash);
    event DisputeResolved(uint256 indexed orderId, bool refundBuyer, string note);

    event SellerBanned(address indexed seller, bool banned);
    event SellerVerified(address indexed seller, bool verified);
    event FeeUpdated(uint16 feeBps);
    event DeadlinesUpdated(uint32 shipWindow, uint32 confirmWindow);
    event Withdrawn(address indexed account, uint256 amount);
    event FeesWithdrawn(address indexed to, uint256 amount);

    // ──────────────────────────── Errors ─────────────────────────────

    error ProductNotFound(uint256 productId);
    error OrderNotFound(uint256 orderId);
    error NotProductSeller();
    error NotOrderSeller();
    error NotOrderBuyer();
    error SellerIsBanned(address seller);
    error InvalidTitle();
    error InvalidPrice();
    error InvalidStock();
    error InvalidQuantity();
    error InvalidTracking();
    error InvalidNote();
    error InvalidFee();
    error InvalidWindow();
    error InvalidAddress();
    error EmptyCart();
    error CartTooLarge();
    error ArrayLengthMismatch();
    error ProductUnavailable(uint256 productId);
    error CannotBuyOwnProduct(uint256 productId);
    error InsufficientStock(uint256 productId, uint32 available, uint32 requested);
    error IncorrectPayment(uint256 expected, uint256 sent);
    error InvalidStatus(OrderStatus current);
    error DeadlinePassed();
    error DeadlineNotReached();
    error NothingToWithdraw();
    error TransferFailed();

    // ─────────────────────────── Constructor ─────────────────────────

    /**
     * @param initialFeeBps ค่าธรรมเนียม (bps) เช่น 200 = 2%
     * @param initialShipWindow เวลาที่ผู้ขายต้องจัดส่ง (วินาที) เช่น 3 days
     * @param initialConfirmWindow เวลาที่ผู้ซื้อต้องยืนยัน (วินาที) เช่น 7 days
     * @param extraAdmins Admin เพิ่มเติมนอกจากผู้ deploy (ใส่ [] ได้)
     */
    constructor(
        uint16 initialFeeBps,
        uint32 initialShipWindow,
        uint32 initialConfirmWindow,
        address[] memory extraAdmins
    ) {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ADMIN_ROLE, msg.sender);
        for (uint256 i = 0; i < extraAdmins.length; ++i) {
            if (extraAdmins[i] == address(0)) revert InvalidAddress();
            _grantRole(ADMIN_ROLE, extraAdmins[i]);
        }
        _setFee(initialFeeBps);
        _setDeadlines(initialShipWindow, initialConfirmWindow);
    }

    /// @notice รายชื่อ Admin ทั้งหมด (ADMIN_ROLE)
    function getAdmins() external view returns (address[] memory) {
        return getRoleMembers(ADMIN_ROLE);
    }

    // ─────────────────────────── Modifiers ───────────────────────────

    modifier productExists(uint256 productId) {
        if (productId == 0 || productId > productCount) revert ProductNotFound(productId);
        _;
    }

    modifier orderExists(uint256 orderId) {
        if (orderId == 0 || orderId > orderCount) revert OrderNotFound(orderId);
        _;
    }

    // ═══════════════════════════ ผู้ขาย ═══════════════════════════════

    /// @notice ลงขายสินค้าใหม่
    function listProduct(
        string calldata title,
        Category category,
        Condition condition,
        uint256 price,
        uint32 stock,
        bytes32 detailsHash
    ) external whenNotPaused returns (uint256 productId) {
        if (_sellers[msg.sender].banned) revert SellerIsBanned(msg.sender);
        uint256 titleLength = bytes(title).length;
        if (titleLength == 0 || titleLength > MAX_TITLE_LENGTH) revert InvalidTitle();
        if (price == 0) revert InvalidPrice();
        if (stock == 0) revert InvalidStock();

        productId = ++productCount;
        uint64 nowTs = uint64(block.timestamp);
        _products[productId] = Product({
            id: productId,
            seller: msg.sender,
            title: title,
            category: category,
            condition: condition,
            price: price,
            stock: stock,
            active: true,
            hidden: false,
            detailsHash: detailsHash,
            createdAt: nowTs,
            updatedAt: nowTs
        });

        emit ProductListed(productId, msg.sender, title, category, condition, price, stock, detailsHash);
    }

    /// @notice แก้ไขราคา สต็อก และ hash รายละเอียด (ไม่กระทบคำสั่งซื้อที่จ่ายแล้ว)
    function updateProduct(
        uint256 productId,
        uint256 price,
        uint32 stock,
        bytes32 detailsHash
    ) external productExists(productId) {
        Product storage p = _products[productId];
        if (p.seller != msg.sender) revert NotProductSeller();
        if (price == 0) revert InvalidPrice();

        p.price = price;
        p.stock = stock;
        p.detailsHash = detailsHash;
        p.updatedAt = uint64(block.timestamp);

        emit ProductUpdated(productId, price, stock, detailsHash);
    }

    /// @notice เปิดหรือปิดการขายสินค้า
    function setProductActive(uint256 productId, bool active) external productExists(productId) {
        Product storage p = _products[productId];
        if (p.seller != msg.sender) revert NotProductSeller();
        p.active = active;
        p.updatedAt = uint64(block.timestamp);
        emit ProductActiveChanged(productId, active);
    }

    /// @notice แจ้งจัดส่งพร้อมเลขพัสดุ (ต้องทำก่อน shipDeadline)
    function markShipped(uint256 orderId, string calldata trackingNo) external orderExists(orderId) {
        Order storage o = _orders[orderId];
        if (o.seller != msg.sender) revert NotOrderSeller();
        if (o.status != OrderStatus.Paid) revert InvalidStatus(o.status);
        if (block.timestamp > o.shipDeadline) revert DeadlinePassed();
        uint256 len = bytes(trackingNo).length;
        if (len == 0 || len > MAX_TRACKING_LENGTH) revert InvalidTracking();

        o.status = OrderStatus.Shipped;
        o.trackingNo = trackingNo;
        o.shippedAt = uint64(block.timestamp);
        o.confirmDeadline = uint64(block.timestamp) + o.confirmWindow;

        emit OrderShipped(orderId, trackingNo, o.confirmDeadline);
    }

    /// @notice ผู้ขายยกเลิกคำสั่งซื้อก่อนจัดส่ง → คืนเงินผู้ซื้อเต็มจำนวน
    function cancelOrder(uint256 orderId) external orderExists(orderId) {
        Order storage o = _orders[orderId];
        if (o.seller != msg.sender) revert NotOrderSeller();
        if (o.status != OrderStatus.Paid) revert InvalidStatus(o.status);
        _refund(o);
    }

    /// @notice ผู้ซื้อไม่ยืนยันภายในกำหนด → ผู้ขายรับเงินเอง
    function claimPayment(uint256 orderId) external orderExists(orderId) {
        Order storage o = _orders[orderId];
        if (o.seller != msg.sender) revert NotOrderSeller();
        if (o.status != OrderStatus.Shipped) revert InvalidStatus(o.status);
        if (block.timestamp <= o.confirmDeadline) revert DeadlineNotReached();
        _complete(o);
    }

    // ═══════════════════════════ ผู้ซื้อ ══════════════════════════════

    /**
     * @notice ชำระเงินทั้งตะกร้าในธุรกรรมเดียว (MetaMask เด้งครั้งเดียว)
     * @dev สร้างคำสั่งซื้อย่อย 1 รายการต่อสินค้า 1 ชนิด, msg.value ต้องเท่ากับยอดรวมพอดี
     */
    function checkout(
        uint256[] calldata productIds,
        uint32[] calldata quantities
    ) external payable whenNotPaused returns (uint256[] memory orderIds) {
        uint256 n = productIds.length;
        if (n == 0) revert EmptyCart();
        if (n > MAX_CART_ITEMS) revert CartTooLarge();
        if (n != quantities.length) revert ArrayLengthMismatch();

        orderIds = new uint256[](n);
        uint256 grandTotal;

        for (uint256 i = 0; i < n; ++i) {
            uint256 lineTotal;
            (orderIds[i], lineTotal) = _placeOrder(productIds[i], quantities[i]);
            grandTotal += lineTotal;
        }

        if (msg.value != grandTotal) revert IncorrectPayment(grandTotal, msg.value);
        totalEscrow += grandTotal;
    }

    /// @dev ตรวจสินค้า ตัดสต็อก และสร้างคำสั่งซื้อ 1 รายการ (แยกออกมาเพื่อไม่ให้ stack ลึกเกิน)
    function _placeOrder(uint256 productId, uint32 qty) private returns (uint256 orderId, uint256 lineTotal) {
        if (productId == 0 || productId > productCount) revert ProductNotFound(productId);

        Product storage p = _products[productId];
        if (!p.active || p.hidden || _sellers[p.seller].banned) revert ProductUnavailable(productId);
        if (p.seller == msg.sender) revert CannotBuyOwnProduct(productId);
        if (qty == 0) revert InvalidQuantity();
        if (p.stock < qty) revert InsufficientStock(productId, p.stock, qty);

        p.stock -= qty;
        lineTotal = p.price * qty;

        orderId = ++orderCount;
        Order storage o = _orders[orderId];
        o.id = orderId;
        o.productId = productId;
        o.buyer = msg.sender;
        o.seller = p.seller;
        o.quantity = qty;
        o.unitPrice = p.price;
        o.total = lineTotal;
        o.feeBps = feeBps;
        o.confirmWindow = confirmWindow;
        o.status = OrderStatus.Paid;
        o.paidAt = uint64(block.timestamp);
        o.shipDeadline = uint64(block.timestamp) + shipWindow;

        _emitOrderPlaced(o);
    }

    function _emitOrderPlaced(Order storage o) private {
        emit OrderPlaced(
            o.id,
            o.productId,
            o.buyer,
            o.seller,
            o.quantity,
            o.unitPrice,
            o.total,
            o.feeBps,
            o.shipDeadline
        );
    }

    /// @notice ยืนยันว่าได้รับของแล้ว → ปลดเงินให้ผู้ขาย
    function confirmReceived(uint256 orderId) external orderExists(orderId) {
        Order storage o = _orders[orderId];
        if (o.buyer != msg.sender) revert NotOrderBuyer();
        if (o.status != OrderStatus.Shipped) revert InvalidStatus(o.status);
        _complete(o);
    }

    /// @notice ผู้ขายไม่จัดส่งภายในกำหนด → ผู้ซื้อขอเงินคืน
    function requestRefund(uint256 orderId) external orderExists(orderId) {
        Order storage o = _orders[orderId];
        if (o.buyer != msg.sender) revert NotOrderBuyer();
        if (o.status != OrderStatus.Paid) revert InvalidStatus(o.status);
        if (block.timestamp <= o.shipDeadline) revert DeadlineNotReached();
        _refund(o);
    }

    /// @notice เปิดข้อพิพาท (หลังจัดส่ง และก่อนพ้นกำหนดยืนยัน)
    function openDispute(uint256 orderId, bytes32 reasonHash) external orderExists(orderId) {
        Order storage o = _orders[orderId];
        if (o.buyer != msg.sender) revert NotOrderBuyer();
        if (o.status != OrderStatus.Shipped) revert InvalidStatus(o.status);
        if (block.timestamp > o.confirmDeadline) revert DeadlinePassed();

        o.status = OrderStatus.Disputed;
        o.disputeReasonHash = reasonHash;
        emit DisputeOpened(orderId, reasonHash);
    }

    // ═══════════════════════════ ทุกคน ════════════════════════════════

    /// @notice ถอนยอดเงินที่ถอนได้ของตัวเอง (ทำได้แม้ระบบ pause)
    function withdraw() external nonReentrant {
        uint256 amount = pendingWithdrawals[msg.sender];
        if (amount == 0) revert NothingToWithdraw();
        pendingWithdrawals[msg.sender] = 0;

        (bool ok, ) = payable(msg.sender).call{value: amount}("");
        if (!ok) revert TransferFailed();
        emit Withdrawn(msg.sender, amount);
    }

    // ═══════════════════════════ Admin ════════════════════════════════

    function setProductHidden(uint256 productId, bool hidden) external onlyRole(ADMIN_ROLE) productExists(productId) {
        _products[productId].hidden = hidden;
        emit ProductHidden(productId, hidden);
    }

    function setSellerBanned(address seller, bool banned) external onlyRole(ADMIN_ROLE) {
        if (seller == address(0)) revert InvalidAddress();
        _sellers[seller].banned = banned;
        emit SellerBanned(seller, banned);
    }

    function setSellerVerified(address seller, bool verified) external onlyRole(ADMIN_ROLE) {
        if (seller == address(0)) revert InvalidAddress();
        _sellers[seller].verified = verified;
        emit SellerVerified(seller, verified);
    }

    /// @notice ตัดสินข้อพิพาท: refundBuyer = true คืนเงินผู้ซื้อ, false จ่ายผู้ขาย
    function resolveDispute(
        uint256 orderId,
        bool refundBuyer,
        string calldata note
    ) external onlyRole(ADMIN_ROLE) orderExists(orderId) {
        Order storage o = _orders[orderId];
        if (o.status != OrderStatus.Disputed) revert InvalidStatus(o.status);
        if (bytes(note).length > MAX_NOTE_LENGTH) revert InvalidNote();

        if (refundBuyer) {
            _refund(o);
        } else {
            _complete(o);
        }
        emit DisputeResolved(orderId, refundBuyer, note);
    }

    function setFee(uint16 newFeeBps) external onlyRole(ADMIN_ROLE) {
        _setFee(newFeeBps);
    }

    function setDeadlines(uint32 newShipWindow, uint32 newConfirmWindow) external onlyRole(ADMIN_ROLE) {
        _setDeadlines(newShipWindow, newConfirmWindow);
    }

    function pause() external onlyRole(ADMIN_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(ADMIN_ROLE) {
        _unpause();
    }

    /// @notice ถอนค่าธรรมเนียมสะสม (ถอนเงิน escrow ของผู้ซื้อไม่ได้)
    function withdrawFees(address payable to) external onlyRole(ADMIN_ROLE) nonReentrant {
        if (to == address(0)) revert InvalidAddress();
        uint256 amount = accumulatedFees;
        if (amount == 0) revert NothingToWithdraw();
        accumulatedFees = 0;

        (bool ok, ) = to.call{value: amount}("");
        if (!ok) revert TransferFailed();
        emit FeesWithdrawn(to, amount);
    }

    // ═══════════════════════════ View ═════════════════════════════════

    function getProduct(uint256 productId) external view productExists(productId) returns (Product memory) {
        return _products[productId];
    }

    function getOrder(uint256 orderId) external view orderExists(orderId) returns (Order memory) {
        return _orders[orderId];
    }

    function getSellerInfo(address seller) external view returns (SellerInfo memory) {
        return _sellers[seller];
    }

    /// @notice อ่านสินค้าทีละหน้า (offset เริ่มที่ 0) ใช้สำรองกรณีไม่มี Supabase
    function getProducts(uint256 offset, uint256 limit) external view returns (Product[] memory list) {
        uint256 total = productCount;
        if (offset >= total) return new Product[](0);
        uint256 end = offset + limit;
        if (end > total) end = total;
        list = new Product[](end - offset);
        for (uint256 i = offset; i < end; ++i) {
            list[i - offset] = _products[i + 1];
        }
    }

    /// @notice อ่านคำสั่งซื้อทีละหน้า (offset เริ่มที่ 0)
    function getOrders(uint256 offset, uint256 limit) external view returns (Order[] memory list) {
        uint256 total = orderCount;
        if (offset >= total) return new Order[](0);
        uint256 end = offset + limit;
        if (end > total) end = total;
        list = new Order[](end - offset);
        for (uint256 i = offset; i < end; ++i) {
            list[i - offset] = _orders[i + 1];
        }
    }

    // ═══════════════════════════ Internal ═════════════════════════════

    function _complete(Order storage o) private {
        o.status = OrderStatus.Completed;
        uint256 fee = (o.total * o.feeBps) / BPS_DENOMINATOR;
        uint256 sellerAmount = o.total - fee;

        totalEscrow -= o.total;
        accumulatedFees += fee;
        pendingWithdrawals[o.seller] += sellerAmount;

        emit OrderCompleted(o.id, sellerAmount, fee);
    }

    function _refund(Order storage o) private {
        o.status = OrderStatus.Refunded;
        totalEscrow -= o.total;
        pendingWithdrawals[o.buyer] += o.total;
        _products[o.productId].stock += o.quantity; // คืนสต็อก

        emit OrderRefunded(o.id, o.total);
    }

    function _setFee(uint16 newFeeBps) private {
        if (newFeeBps > MAX_FEE_BPS) revert InvalidFee();
        feeBps = newFeeBps;
        emit FeeUpdated(newFeeBps);
    }

    function _setDeadlines(uint32 newShipWindow, uint32 newConfirmWindow) private {
        if (newShipWindow == 0 || newShipWindow > MAX_WINDOW) revert InvalidWindow();
        if (newConfirmWindow == 0 || newConfirmWindow > MAX_WINDOW) revert InvalidWindow();
        shipWindow = newShipWindow;
        confirmWindow = newConfirmWindow;
        emit DeadlinesUpdated(newShipWindow, newConfirmWindow);
    }

    /// @dev ปฏิเสธ ETH ที่ส่งมาตรง ๆ (ต้องจ่ายผ่าน checkout เท่านั้น)
    receive() external payable {
        revert IncorrectPayment(0, msg.value);
    }
}
