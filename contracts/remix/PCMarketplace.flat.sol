// Sources flattened with hardhat v2.29.2 https://hardhat.org

// SPDX-License-Identifier: MIT

// File @openzeppelin/contracts/utils/Context.sol@v5.6.1

// Original license: SPDX_License_Identifier: MIT
// OpenZeppelin Contracts (last updated v5.0.1) (utils/Context.sol)

pragma solidity ^0.8.20;

/**
 * @dev Provides information about the current execution context, including the
 * sender of the transaction and its data. While these are generally available
 * via msg.sender and msg.data, they should not be accessed in such a direct
 * manner, since when dealing with meta-transactions the account sending and
 * paying for execution may not be the actual sender (as far as an application
 * is concerned).
 *
 * This contract is only required for intermediate, library-like contracts.
 */
abstract contract Context {
    function _msgSender() internal view virtual returns (address) {
        return msg.sender;
    }

    function _msgData() internal view virtual returns (bytes calldata) {
        return msg.data;
    }

    function _contextSuffixLength() internal view virtual returns (uint256) {
        return 0;
    }
}


// File @openzeppelin/contracts/access/Ownable.sol@v5.6.1

// Original license: SPDX_License_Identifier: MIT
// OpenZeppelin Contracts (last updated v5.0.0) (access/Ownable.sol)

pragma solidity ^0.8.20;

/**
 * @dev Contract module which provides a basic access control mechanism, where
 * there is an account (an owner) that can be granted exclusive access to
 * specific functions.
 *
 * The initial owner is set to the address provided by the deployer. This can
 * later be changed with {transferOwnership}.
 *
 * This module is used through inheritance. It will make available the modifier
 * `onlyOwner`, which can be applied to your functions to restrict their use to
 * the owner.
 */
abstract contract Ownable is Context {
    address private _owner;

    /**
     * @dev The caller account is not authorized to perform an operation.
     */
    error OwnableUnauthorizedAccount(address account);

    /**
     * @dev The owner is not a valid owner account. (eg. `address(0)`)
     */
    error OwnableInvalidOwner(address owner);

    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    /**
     * @dev Initializes the contract setting the address provided by the deployer as the initial owner.
     */
    constructor(address initialOwner) {
        if (initialOwner == address(0)) {
            revert OwnableInvalidOwner(address(0));
        }
        _transferOwnership(initialOwner);
    }

    /**
     * @dev Throws if called by any account other than the owner.
     */
    modifier onlyOwner() {
        _checkOwner();
        _;
    }

    /**
     * @dev Returns the address of the current owner.
     */
    function owner() public view virtual returns (address) {
        return _owner;
    }

    /**
     * @dev Throws if the sender is not the owner.
     */
    function _checkOwner() internal view virtual {
        if (owner() != _msgSender()) {
            revert OwnableUnauthorizedAccount(_msgSender());
        }
    }

    /**
     * @dev Leaves the contract without owner. It will not be possible to call
     * `onlyOwner` functions. Can only be called by the current owner.
     *
     * NOTE: Renouncing ownership will leave the contract without an owner,
     * thereby disabling any functionality that is only available to the owner.
     */
    function renounceOwnership() public virtual onlyOwner {
        _transferOwnership(address(0));
    }

    /**
     * @dev Transfers ownership of the contract to a new account (`newOwner`).
     * Can only be called by the current owner.
     */
    function transferOwnership(address newOwner) public virtual onlyOwner {
        if (newOwner == address(0)) {
            revert OwnableInvalidOwner(address(0));
        }
        _transferOwnership(newOwner);
    }

    /**
     * @dev Transfers ownership of the contract to a new account (`newOwner`).
     * Internal function without access restriction.
     */
    function _transferOwnership(address newOwner) internal virtual {
        address oldOwner = _owner;
        _owner = newOwner;
        emit OwnershipTransferred(oldOwner, newOwner);
    }
}


// File @openzeppelin/contracts/utils/Pausable.sol@v5.6.1

// Original license: SPDX_License_Identifier: MIT
// OpenZeppelin Contracts (last updated v5.3.0) (utils/Pausable.sol)

pragma solidity ^0.8.20;

/**
 * @dev Contract module which allows children to implement an emergency stop
 * mechanism that can be triggered by an authorized account.
 *
 * This module is used through inheritance. It will make available the
 * modifiers `whenNotPaused` and `whenPaused`, which can be applied to
 * the functions of your contract. Note that they will not be pausable by
 * simply including this module, only once the modifiers are put in place.
 */
abstract contract Pausable is Context {
    bool private _paused;

    /**
     * @dev Emitted when the pause is triggered by `account`.
     */
    event Paused(address account);

    /**
     * @dev Emitted when the pause is lifted by `account`.
     */
    event Unpaused(address account);

    /**
     * @dev The operation failed because the contract is paused.
     */
    error EnforcedPause();

    /**
     * @dev The operation failed because the contract is not paused.
     */
    error ExpectedPause();

    /**
     * @dev Modifier to make a function callable only when the contract is not paused.
     *
     * Requirements:
     *
     * - The contract must not be paused.
     */
    modifier whenNotPaused() {
        _requireNotPaused();
        _;
    }

    /**
     * @dev Modifier to make a function callable only when the contract is paused.
     *
     * Requirements:
     *
     * - The contract must be paused.
     */
    modifier whenPaused() {
        _requirePaused();
        _;
    }

    /**
     * @dev Returns true if the contract is paused, and false otherwise.
     */
    function paused() public view virtual returns (bool) {
        return _paused;
    }

    /**
     * @dev Throws if the contract is paused.
     */
    function _requireNotPaused() internal view virtual {
        if (paused()) {
            revert EnforcedPause();
        }
    }

    /**
     * @dev Throws if the contract is not paused.
     */
    function _requirePaused() internal view virtual {
        if (!paused()) {
            revert ExpectedPause();
        }
    }

    /**
     * @dev Triggers stopped state.
     *
     * Requirements:
     *
     * - The contract must not be paused.
     */
    function _pause() internal virtual whenNotPaused {
        _paused = true;
        emit Paused(_msgSender());
    }

    /**
     * @dev Returns to normal state.
     *
     * Requirements:
     *
     * - The contract must be paused.
     */
    function _unpause() internal virtual whenPaused {
        _paused = false;
        emit Unpaused(_msgSender());
    }
}


// File @openzeppelin/contracts/utils/StorageSlot.sol@v5.6.1

// Original license: SPDX_License_Identifier: MIT
// OpenZeppelin Contracts (last updated v5.1.0) (utils/StorageSlot.sol)
// This file was procedurally generated from scripts/generate/templates/StorageSlot.js.

pragma solidity ^0.8.20;

/**
 * @dev Library for reading and writing primitive types to specific storage slots.
 *
 * Storage slots are often used to avoid storage conflict when dealing with upgradeable contracts.
 * This library helps with reading and writing to such slots without the need for inline assembly.
 *
 * The functions in this library return Slot structs that contain a `value` member that can be used to read or write.
 *
 * Example usage to set ERC-1967 implementation slot:
 * ```solidity
 * contract ERC1967 {
 *     // Define the slot. Alternatively, use the SlotDerivation library to derive the slot.
 *     bytes32 internal constant _IMPLEMENTATION_SLOT = 0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc;
 *
 *     function _getImplementation() internal view returns (address) {
 *         return StorageSlot.getAddressSlot(_IMPLEMENTATION_SLOT).value;
 *     }
 *
 *     function _setImplementation(address newImplementation) internal {
 *         require(newImplementation.code.length > 0);
 *         StorageSlot.getAddressSlot(_IMPLEMENTATION_SLOT).value = newImplementation;
 *     }
 * }
 * ```
 *
 * TIP: Consider using this library along with {SlotDerivation}.
 */
library StorageSlot {
    struct AddressSlot {
        address value;
    }

    struct BooleanSlot {
        bool value;
    }

    struct Bytes32Slot {
        bytes32 value;
    }

    struct Uint256Slot {
        uint256 value;
    }

    struct Int256Slot {
        int256 value;
    }

    struct StringSlot {
        string value;
    }

    struct BytesSlot {
        bytes value;
    }

    /**
     * @dev Returns an `AddressSlot` with member `value` located at `slot`.
     */
    function getAddressSlot(bytes32 slot) internal pure returns (AddressSlot storage r) {
        assembly ("memory-safe") {
            r.slot := slot
        }
    }

    /**
     * @dev Returns a `BooleanSlot` with member `value` located at `slot`.
     */
    function getBooleanSlot(bytes32 slot) internal pure returns (BooleanSlot storage r) {
        assembly ("memory-safe") {
            r.slot := slot
        }
    }

    /**
     * @dev Returns a `Bytes32Slot` with member `value` located at `slot`.
     */
    function getBytes32Slot(bytes32 slot) internal pure returns (Bytes32Slot storage r) {
        assembly ("memory-safe") {
            r.slot := slot
        }
    }

    /**
     * @dev Returns a `Uint256Slot` with member `value` located at `slot`.
     */
    function getUint256Slot(bytes32 slot) internal pure returns (Uint256Slot storage r) {
        assembly ("memory-safe") {
            r.slot := slot
        }
    }

    /**
     * @dev Returns a `Int256Slot` with member `value` located at `slot`.
     */
    function getInt256Slot(bytes32 slot) internal pure returns (Int256Slot storage r) {
        assembly ("memory-safe") {
            r.slot := slot
        }
    }

    /**
     * @dev Returns a `StringSlot` with member `value` located at `slot`.
     */
    function getStringSlot(bytes32 slot) internal pure returns (StringSlot storage r) {
        assembly ("memory-safe") {
            r.slot := slot
        }
    }

    /**
     * @dev Returns an `StringSlot` representation of the string storage pointer `store`.
     */
    function getStringSlot(string storage store) internal pure returns (StringSlot storage r) {
        assembly ("memory-safe") {
            r.slot := store.slot
        }
    }

    /**
     * @dev Returns a `BytesSlot` with member `value` located at `slot`.
     */
    function getBytesSlot(bytes32 slot) internal pure returns (BytesSlot storage r) {
        assembly ("memory-safe") {
            r.slot := slot
        }
    }

    /**
     * @dev Returns an `BytesSlot` representation of the bytes storage pointer `store`.
     */
    function getBytesSlot(bytes storage store) internal pure returns (BytesSlot storage r) {
        assembly ("memory-safe") {
            r.slot := store.slot
        }
    }
}


// File @openzeppelin/contracts/utils/ReentrancyGuard.sol@v5.6.1

// Original license: SPDX_License_Identifier: MIT
// OpenZeppelin Contracts (last updated v5.5.0) (utils/ReentrancyGuard.sol)

pragma solidity ^0.8.20;

/**
 * @dev Contract module that helps prevent reentrant calls to a function.
 *
 * Inheriting from `ReentrancyGuard` will make the {nonReentrant} modifier
 * available, which can be applied to functions to make sure there are no nested
 * (reentrant) calls to them.
 *
 * Note that because there is a single `nonReentrant` guard, functions marked as
 * `nonReentrant` may not call one another. This can be worked around by making
 * those functions `private`, and then adding `external` `nonReentrant` entry
 * points to them.
 *
 * TIP: If EIP-1153 (transient storage) is available on the chain you're deploying at,
 * consider using {ReentrancyGuardTransient} instead.
 *
 * TIP: If you would like to learn more about reentrancy and alternative ways
 * to protect against it, check out our blog post
 * https://blog.openzeppelin.com/reentrancy-after-istanbul/[Reentrancy After Istanbul].
 *
 * IMPORTANT: Deprecated. This storage-based reentrancy guard will be removed and replaced
 * by the {ReentrancyGuardTransient} variant in v6.0.
 *
 * @custom:stateless
 */
abstract contract ReentrancyGuard {
    using StorageSlot for bytes32;

    // keccak256(abi.encode(uint256(keccak256("openzeppelin.storage.ReentrancyGuard")) - 1)) & ~bytes32(uint256(0xff))
    bytes32 private constant REENTRANCY_GUARD_STORAGE =
        0x9b779b17422d0df92223018b32b4d1fa46e071723d6817e2486d003becc55f00;

    // Booleans are more expensive than uint256 or any type that takes up a full
    // word because each write operation emits an extra SLOAD to first read the
    // slot's contents, replace the bits taken up by the boolean, and then write
    // back. This is the compiler's defense against contract upgrades and
    // pointer aliasing, and it cannot be disabled.

    // The values being non-zero value makes deployment a bit more expensive,
    // but in exchange the refund on every call to nonReentrant will be lower in
    // amount. Since refunds are capped to a percentage of the total
    // transaction's gas, it is best to keep them low in cases like this one, to
    // increase the likelihood of the full refund coming into effect.
    uint256 private constant NOT_ENTERED = 1;
    uint256 private constant ENTERED = 2;

    /**
     * @dev Unauthorized reentrant call.
     */
    error ReentrancyGuardReentrantCall();

    constructor() {
        _reentrancyGuardStorageSlot().getUint256Slot().value = NOT_ENTERED;
    }

    /**
     * @dev Prevents a contract from calling itself, directly or indirectly.
     * Calling a `nonReentrant` function from another `nonReentrant`
     * function is not supported. It is possible to prevent this from happening
     * by making the `nonReentrant` function external, and making it call a
     * `private` function that does the actual work.
     */
    modifier nonReentrant() {
        _nonReentrantBefore();
        _;
        _nonReentrantAfter();
    }

    /**
     * @dev A `view` only version of {nonReentrant}. Use to block view functions
     * from being called, preventing reading from inconsistent contract state.
     *
     * CAUTION: This is a "view" modifier and does not change the reentrancy
     * status. Use it only on view functions. For payable or non-payable functions,
     * use the standard {nonReentrant} modifier instead.
     */
    modifier nonReentrantView() {
        _nonReentrantBeforeView();
        _;
    }

    function _nonReentrantBeforeView() private view {
        if (_reentrancyGuardEntered()) {
            revert ReentrancyGuardReentrantCall();
        }
    }

    function _nonReentrantBefore() private {
        // On the first call to nonReentrant, _status will be NOT_ENTERED
        _nonReentrantBeforeView();

        // Any calls to nonReentrant after this point will fail
        _reentrancyGuardStorageSlot().getUint256Slot().value = ENTERED;
    }

    function _nonReentrantAfter() private {
        // By storing the original value once again, a refund is triggered (see
        // https://eips.ethereum.org/EIPS/eip-2200)
        _reentrancyGuardStorageSlot().getUint256Slot().value = NOT_ENTERED;
    }

    /**
     * @dev Returns true if the reentrancy guard is currently set to "entered", which indicates there is a
     * `nonReentrant` function in the call stack.
     */
    function _reentrancyGuardEntered() internal view returns (bool) {
        return _reentrancyGuardStorageSlot().getUint256Slot().value == ENTERED;
    }

    function _reentrancyGuardStorageSlot() internal pure virtual returns (bytes32) {
        return REENTRANCY_GUARD_STORAGE;
    }
}


// File contracts/PCMarketplace.sol

// Original license: SPDX_License_Identifier: MIT
pragma solidity ^0.8.24;



/**
 * @title ChainPC – Decentralized PC Marketplace
 * @notice ตลาดซื้อขายคอมพิวเตอร์และอุปกรณ์ IT แบบ Escrow บน Ethereum Hoodi Testnet
 *
 * - ใครก็ลงขายได้ ผู้ซื้อจ่าย ETH ผ่าน MetaMask แล้วเงินถูกล็อกไว้ใน contract
 * - ผู้ขายแจ้งจัดส่ง → ผู้ซื้อยืนยันรับของ → เงินปลดให้ผู้ขาย (หักค่าธรรมเนียม)
 * - ผู้ขายไม่ส่งของตามกำหนด → ผู้ซื้อขอเงินคืนได้
 * - ผู้ซื้อเงียบเกินกำหนด → ผู้ขายรับเงินเองได้
 * - มีข้อพิพาท → Admin (owner) ตัดสิน
 * - เงินทุกก้อนใช้รูปแบบ Pull Payment: บันทึกยอดไว้ แล้วเจ้าของกด withdraw() เอง
 *
 * ข้อความยาว (รายละเอียดสินค้า, ความเห็นรีวิว, เหตุผลข้อพิพาท) เก็บใน Supabase
 * บน chain เก็บแค่ keccak256 hash ไว้ตรวจสอบว่าข้อมูลไม่ถูกแก้ไข
 */
contract PCMarketplace is Ownable, Pausable, ReentrancyGuard {
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
        bool reviewed;
    }

    struct SellerInfo {
        bool verified;
        bool banned;
        uint64 ratingSum;
        uint64 ratingCount;
    }

    // ─────────────────────────── Constants ───────────────────────────

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
    event ReviewAdded(
        uint256 indexed orderId,
        address indexed seller,
        address indexed buyer,
        uint8 rating,
        bytes32 commentHash
    );

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
    error InvalidRating();
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
    error AlreadyReviewed();
    error NothingToWithdraw();
    error TransferFailed();

    // ─────────────────────────── Constructor ─────────────────────────

    /**
     * @param initialFeeBps ค่าธรรมเนียม (bps) เช่น 200 = 2%
     * @param initialShipWindow เวลาที่ผู้ขายต้องจัดส่ง (วินาที) เช่น 3 days
     * @param initialConfirmWindow เวลาที่ผู้ซื้อต้องยืนยัน (วินาที) เช่น 7 days
     */
    constructor(
        uint16 initialFeeBps,
        uint32 initialShipWindow,
        uint32 initialConfirmWindow
    ) Ownable(msg.sender) {
        _setFee(initialFeeBps);
        _setDeadlines(initialShipWindow, initialConfirmWindow);
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

    /// @notice รีวิวผู้ขาย 1–5 ดาว (1 ครั้งต่อคำสั่งซื้อที่สำเร็จ)
    function leaveReview(uint256 orderId, uint8 rating, bytes32 commentHash) external orderExists(orderId) {
        Order storage o = _orders[orderId];
        if (o.buyer != msg.sender) revert NotOrderBuyer();
        if (o.status != OrderStatus.Completed) revert InvalidStatus(o.status);
        if (o.reviewed) revert AlreadyReviewed();
        if (rating < 1 || rating > 5) revert InvalidRating();

        o.reviewed = true;
        SellerInfo storage s = _sellers[o.seller];
        s.ratingSum += rating;
        s.ratingCount += 1;

        emit ReviewAdded(orderId, o.seller, msg.sender, rating, commentHash);
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

    function setProductHidden(uint256 productId, bool hidden) external onlyOwner productExists(productId) {
        _products[productId].hidden = hidden;
        emit ProductHidden(productId, hidden);
    }

    function setSellerBanned(address seller, bool banned) external onlyOwner {
        if (seller == address(0)) revert InvalidAddress();
        _sellers[seller].banned = banned;
        emit SellerBanned(seller, banned);
    }

    function setSellerVerified(address seller, bool verified) external onlyOwner {
        if (seller == address(0)) revert InvalidAddress();
        _sellers[seller].verified = verified;
        emit SellerVerified(seller, verified);
    }

    /// @notice ตัดสินข้อพิพาท: refundBuyer = true คืนเงินผู้ซื้อ, false จ่ายผู้ขาย
    function resolveDispute(
        uint256 orderId,
        bool refundBuyer,
        string calldata note
    ) external onlyOwner orderExists(orderId) {
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

    function setFee(uint16 newFeeBps) external onlyOwner {
        _setFee(newFeeBps);
    }

    function setDeadlines(uint32 newShipWindow, uint32 newConfirmWindow) external onlyOwner {
        _setDeadlines(newShipWindow, newConfirmWindow);
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    /// @notice ถอนค่าธรรมเนียมสะสม (ถอนเงิน escrow ของผู้ซื้อไม่ได้)
    function withdrawFees(address payable to) external onlyOwner nonReentrant {
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
