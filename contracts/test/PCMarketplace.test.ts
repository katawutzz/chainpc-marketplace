import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture, time } from "@nomicfoundation/hardhat-toolbox/network-helpers";

const DAY = 24 * 60 * 60;
const FEE_BPS = 200; // 2%
const SHIP_WINDOW = 3 * DAY;
const CONFIRM_WINDOW = 7 * DAY;

// enum ใน contract
const Category = { BuiltPC: 0, CPU: 1, GPU: 2, RAM: 3, SSD: 4, Mainboard: 5, Monitor: 6, KeyboardMouse: 7, Headset: 8 };
const Condition = { New: 0, Used: 1 };
const Status = { None: 0n, Paid: 1n, Shipped: 2n, Disputed: 3n, Completed: 4n, Refunded: 5n };

const GPU_PRICE = ethers.parseEther("0.05");
const CPU_PRICE = ethers.parseEther("0.03");
const DETAILS_HASH = ethers.id("RTX 4070 Super 12GB, ประกันเหลือ 1 ปี");

describe("PCMarketplace", function () {
  async function deployFixture() {
    const [admin, seller, seller2, buyer, other] = await ethers.getSigners();
    const factory = await ethers.getContractFactory("PCMarketplace");
    const market = await factory.deploy(FEE_BPS, SHIP_WINDOW, CONFIRM_WINDOW, []);
    await market.waitForDeployment();
    return { market, admin, seller, seller2, buyer, other };
  }

  /** ผู้ขาย 2 คน ลงสินค้าคนละ 1 รายการ: #1 GPU (seller, สต็อก 3), #2 CPU (seller2, สต็อก 1) */
  async function listedFixture() {
    const base = await deployFixture();
    const { market, seller, seller2 } = base;
    await market
      .connect(seller)
      .listProduct("RTX 4070 Super", Category.GPU, Condition.Used, GPU_PRICE, 3, DETAILS_HASH);
    await market
      .connect(seller2)
      .listProduct("Ryzen 7 7800X3D", Category.CPU, Condition.New, CPU_PRICE, 1, ethers.ZeroHash);
    return base;
  }

  /** ผู้ซื้อซื้อ GPU 1 ชิ้น → order #1 (Paid) */
  async function paidFixture() {
    const base = await listedFixture();
    await base.market.connect(base.buyer).checkout([1], [1], { value: GPU_PRICE });
    return base;
  }

  /** order #1 ถูกจัดส่งแล้ว (Shipped) */
  async function shippedFixture() {
    const base = await paidFixture();
    await base.market.connect(base.seller).markShipped(1, "TH0001");
    return base;
  }

  /** order #1 สำเร็จแล้ว (Completed) */
  async function completedFixture() {
    const base = await shippedFixture();
    await base.market.connect(base.buyer).confirmReceived(1);
    return base;
  }

  /** order #1 มีข้อพิพาท (Disputed) */
  async function disputedFixture() {
    const base = await shippedFixture();
    await base.market.connect(base.buyer).openDispute(1, ethers.id("ของไม่ตรงปก"));
    return base;
  }

  /** ตรวจว่าเงินใน contract = ยอดที่ทุกคนถอนได้ + ค่าธรรมเนียม + escrow */
  async function expectSolvent(market: any, accounts: string[]) {
    let owed = (await market.accumulatedFees()) + (await market.totalEscrow());
    for (const a of accounts) owed += await market.pendingWithdrawals(a);
    expect(await ethers.provider.getBalance(await market.getAddress())).to.equal(owed);
  }

  // ═══════════════════════════ Deploy ═══════════════════════════

  describe("Deploy", function () {
    it("ตั้งค่าเริ่มต้นถูกต้อง", async function () {
      const { market, admin } = await loadFixture(deployFixture);
      expect(await market.hasRole(await market.ADMIN_ROLE(), admin.address)).to.equal(true);
      expect(await market.feeBps()).to.equal(FEE_BPS);
      expect(await market.shipWindow()).to.equal(SHIP_WINDOW);
      expect(await market.confirmWindow()).to.equal(CONFIRM_WINDOW);
      expect(await market.productCount()).to.equal(0);
      expect(await market.orderCount()).to.equal(0);
    });

    it("ปฏิเสธค่าธรรมเนียมเกิน 10% และระยะเวลาไม่ถูกต้อง", async function () {
      const factory = await ethers.getContractFactory("PCMarketplace");
      await expect(factory.deploy(1001, SHIP_WINDOW, CONFIRM_WINDOW, [])).to.be.revertedWithCustomError(
        factory,
        "InvalidFee"
      );
      await expect(factory.deploy(FEE_BPS, 0, CONFIRM_WINDOW, [])).to.be.revertedWithCustomError(
        factory,
        "InvalidWindow"
      );
      await expect(factory.deploy(FEE_BPS, SHIP_WINDOW, 31 * DAY, [])).to.be.revertedWithCustomError(
        factory,
        "InvalidWindow"
      );
    });

    it("ปฏิเสธ ETH ที่ส่งเข้ามาตรง ๆ", async function () {
      const { market, buyer } = await loadFixture(deployFixture);
      await expect(
        buyer.sendTransaction({ to: await market.getAddress(), value: 1n })
      ).to.be.revertedWithCustomError(market, "IncorrectPayment");
    });
  });

  // ═══════════════════════════ สินค้า ═══════════════════════════

  describe("ลงขายและแก้ไขสินค้า", function () {
    it("ลงขายสินค้าได้และปล่อย Event ProductListed", async function () {
      const { market, seller } = await loadFixture(deployFixture);
      await expect(
        market
          .connect(seller)
          .listProduct("RTX 4070 Super", Category.GPU, Condition.Used, GPU_PRICE, 3, DETAILS_HASH)
      )
        .to.emit(market, "ProductListed")
        .withArgs(1, seller.address, "RTX 4070 Super", Category.GPU, Condition.Used, GPU_PRICE, 3, DETAILS_HASH);

      const p = await market.getProduct(1);
      expect(p.seller).to.equal(seller.address);
      expect(p.price).to.equal(GPU_PRICE);
      expect(p.stock).to.equal(3);
      expect(p.active).to.equal(true);
      expect(p.hidden).to.equal(false);
      expect(p.detailsHash).to.equal(DETAILS_HASH);
    });

    it("ปฏิเสธข้อมูลสินค้าที่ไม่ถูกต้อง", async function () {
      const { market, seller } = await loadFixture(deployFixture);
      const s = market.connect(seller);
      await expect(s.listProduct("", 0, 0, GPU_PRICE, 1, ethers.ZeroHash)).to.be.revertedWithCustomError(
        market,
        "InvalidTitle"
      );
      await expect(s.listProduct("x".repeat(101), 0, 0, GPU_PRICE, 1, ethers.ZeroHash)).to.be.revertedWithCustomError(
        market,
        "InvalidTitle"
      );
      await expect(s.listProduct("PC", 0, 0, 0, 1, ethers.ZeroHash)).to.be.revertedWithCustomError(
        market,
        "InvalidPrice"
      );
      await expect(s.listProduct("PC", 0, 0, GPU_PRICE, 0, ethers.ZeroHash)).to.be.revertedWithCustomError(
        market,
        "InvalidStock"
      );
      // หมวดหมู่เกิน enum (9) → revert
      await expect(s.listProduct("PC", 9, 0, GPU_PRICE, 1, ethers.ZeroHash)).to.be.reverted;
    });

    it("ผู้ขายแก้ราคา สต็อก และ hash ได้", async function () {
      const { market, seller } = await loadFixture(listedFixture);
      const newPrice = ethers.parseEther("0.045");
      const newHash = ethers.id("updated");
      await expect(market.connect(seller).updateProduct(1, newPrice, 5, newHash))
        .to.emit(market, "ProductUpdated")
        .withArgs(1, newPrice, 5, newHash);
      const p = await market.getProduct(1);
      expect(p.price).to.equal(newPrice);
      expect(p.stock).to.equal(5);
      expect(p.detailsHash).to.equal(newHash);
    });

    it("คนอื่นแก้ไขหรือปิดการขายสินค้าที่ไม่ใช่ของตัวเองไม่ได้ (รวมถึง Admin)", async function () {
      const { market, admin, other } = await loadFixture(listedFixture);
      for (const signer of [admin, other]) {
        await expect(
          market.connect(signer).updateProduct(1, GPU_PRICE, 1, ethers.ZeroHash)
        ).to.be.revertedWithCustomError(market, "NotProductSeller");
        await expect(market.connect(signer).setProductActive(1, false)).to.be.revertedWithCustomError(
          market,
          "NotProductSeller"
        );
      }
    });

    it("แก้ราคาเป็น 0 ไม่ได้ และอ้างอิงสินค้าที่ไม่มีอยู่จะ revert", async function () {
      const { market, seller } = await loadFixture(listedFixture);
      await expect(
        market.connect(seller).updateProduct(1, 0, 1, ethers.ZeroHash)
      ).to.be.revertedWithCustomError(market, "InvalidPrice");
      await expect(market.getProduct(0)).to.be.revertedWithCustomError(market, "ProductNotFound");
      await expect(market.getProduct(99)).to.be.revertedWithCustomError(market, "ProductNotFound");
    });

    it("ปิดการขายแล้วซื้อไม่ได้ เปิดใหม่แล้วซื้อได้", async function () {
      const { market, seller, buyer } = await loadFixture(listedFixture);
      await expect(market.connect(seller).setProductActive(1, false))
        .to.emit(market, "ProductActiveChanged")
        .withArgs(1, false);
      await expect(
        market.connect(buyer).checkout([1], [1], { value: GPU_PRICE })
      ).to.be.revertedWithCustomError(market, "ProductUnavailable");

      await market.connect(seller).setProductActive(1, true);
      await expect(market.connect(buyer).checkout([1], [1], { value: GPU_PRICE })).to.emit(market, "OrderPlaced");
    });
  });

  // ═══════════════════════════ Checkout ═══════════════════════════

  describe("Checkout (ตะกร้า)", function () {
    it("ซื้อหลายรายการจากผู้ขายหลายคนในธุรกรรมเดียว", async function () {
      const { market, seller, seller2, buyer } = await loadFixture(listedFixture);
      const total = GPU_PRICE * 2n + CPU_PRICE;
      const tx = market.connect(buyer).checkout([1, 2], [2, 1], { value: total });

      await expect(tx).to.changeEtherBalances([buyer, market], [-total, total]);
      await expect(tx)
        .to.emit(market, "OrderPlaced")
        .withArgs(1, 1, buyer.address, seller.address, 2, GPU_PRICE, GPU_PRICE * 2n, FEE_BPS, (v: bigint) => v > 0n);

      expect(await market.orderCount()).to.equal(2);
      expect(await market.totalEscrow()).to.equal(total);

      const o1 = await market.getOrder(1);
      const o2 = await market.getOrder(2);
      expect(o1.seller).to.equal(seller.address);
      expect(o2.seller).to.equal(seller2.address);
      expect(o1.status).to.equal(Status.Paid);
      expect(o1.shipDeadline).to.equal(o1.paidAt + BigInt(SHIP_WINDOW));

      // ตัดสต็อก
      expect((await market.getProduct(1)).stock).to.equal(1);
      expect((await market.getProduct(2)).stock).to.equal(0);
    });

    it("คืนค่า orderIds จาก checkout", async function () {
      const { market, buyer } = await loadFixture(listedFixture);
      const ids = await market
        .connect(buyer)
        .checkout.staticCall([1, 2], [1, 1], { value: GPU_PRICE + CPU_PRICE });
      expect(ids).to.deep.equal([1n, 2n]);
    });

    it("ยอดเงินไม่ตรงจะถูกปฏิเสธทั้งหมด (ทั้งขาดและเกิน)", async function () {
      const { market, buyer } = await loadFixture(listedFixture);
      const total = GPU_PRICE + CPU_PRICE;
      await expect(market.connect(buyer).checkout([1, 2], [1, 1], { value: total - 1n }))
        .to.be.revertedWithCustomError(market, "IncorrectPayment")
        .withArgs(total, total - 1n);
      await expect(
        market.connect(buyer).checkout([1, 2], [1, 1], { value: total + 1n })
      ).to.be.revertedWithCustomError(market, "IncorrectPayment");
      // ไม่มีอะไรเปลี่ยน
      expect(await market.orderCount()).to.equal(0);
      expect((await market.getProduct(1)).stock).to.equal(3);
    });

    it("สต็อกไม่พอ", async function () {
      const { market, buyer } = await loadFixture(listedFixture);
      await expect(market.connect(buyer).checkout([2], [2], { value: CPU_PRICE * 2n }))
        .to.be.revertedWithCustomError(market, "InsufficientStock")
        .withArgs(2, 1, 2);
    });

    it("ใส่สินค้าเดียวกันซ้ำในตะกร้าจนเกินสต็อกไม่ได้", async function () {
      const { market, buyer } = await loadFixture(listedFixture);
      await expect(
        market.connect(buyer).checkout([2, 2], [1, 1], { value: CPU_PRICE * 2n })
      ).to.be.revertedWithCustomError(market, "InsufficientStock");
    });

    it("ห้ามซื้อสินค้าของตัวเอง", async function () {
      const { market, seller } = await loadFixture(listedFixture);
      await expect(market.connect(seller).checkout([1], [1], { value: GPU_PRICE }))
        .to.be.revertedWithCustomError(market, "CannotBuyOwnProduct")
        .withArgs(1);
    });

    it("ตรวจตะกร้าว่าง ใหญ่เกิน ความยาว array ไม่ตรง จำนวน 0 และสินค้าที่ไม่มี", async function () {
      const { market, buyer } = await loadFixture(listedFixture);
      const b = market.connect(buyer);
      await expect(b.checkout([], [], { value: 0 })).to.be.revertedWithCustomError(market, "EmptyCart");
      await expect(
        b.checkout(Array(21).fill(1), Array(21).fill(1), { value: 0 })
      ).to.be.revertedWithCustomError(market, "CartTooLarge");
      await expect(b.checkout([1, 2], [1], { value: GPU_PRICE })).to.be.revertedWithCustomError(
        market,
        "ArrayLengthMismatch"
      );
      await expect(b.checkout([1], [0], { value: 0 })).to.be.revertedWithCustomError(market, "InvalidQuantity");
      await expect(b.checkout([99], [1], { value: 0 }))
        .to.be.revertedWithCustomError(market, "ProductNotFound")
        .withArgs(99);
      await expect(b.checkout([0], [1], { value: 0 })).to.be.revertedWithCustomError(market, "ProductNotFound");
    });

    it("แก้ราคาหลังมีคำสั่งซื้อแล้ว ไม่กระทบคำสั่งซื้อเดิม", async function () {
      const { market, seller, buyer } = await loadFixture(paidFixture);
      await market.connect(seller).updateProduct(1, ethers.parseEther("1"), 2, ethers.ZeroHash);
      const o = await market.getOrder(1);
      expect(o.unitPrice).to.equal(GPU_PRICE);
      expect(o.total).to.equal(GPU_PRICE);

      // ทำรายการให้จบ → ผู้ขายได้ตามราคาเดิม
      await market.connect(seller).markShipped(1, "TH1");
      await market.connect(buyer).confirmReceived(1);
      const fee = (GPU_PRICE * BigInt(FEE_BPS)) / 10000n;
      expect(await market.pendingWithdrawals(seller.address)).to.equal(GPU_PRICE - fee);
    });

    it("เปลี่ยนค่าธรรมเนียมและระยะเวลาหลังจ่ายแล้ว ไม่กระทบคำสั่งซื้อเดิม", async function () {
      const { market, admin, seller, buyer } = await loadFixture(paidFixture);
      await market.connect(admin).setFee(1000);
      await market.connect(admin).setDeadlines(60, 60);

      const o = await market.getOrder(1);
      expect(o.feeBps).to.equal(FEE_BPS);
      expect(o.confirmWindow).to.equal(CONFIRM_WINDOW);

      await market.connect(seller).markShipped(1, "TH1");
      const shipped = await market.getOrder(1);
      expect(shipped.confirmDeadline).to.equal(shipped.shippedAt + BigInt(CONFIRM_WINDOW));

      await market.connect(buyer).confirmReceived(1);
      expect(await market.accumulatedFees()).to.equal((GPU_PRICE * BigInt(FEE_BPS)) / 10000n);
    });
  });

  // ═══════════════════════════ Flow ปกติ ═══════════════════════════

  describe("Flow ปกติ: Paid → Shipped → Completed", function () {
    it("ผู้ขายแจ้งจัดส่งพร้อมเลขพัสดุ", async function () {
      const { market, seller } = await loadFixture(paidFixture);
      await expect(market.connect(seller).markShipped(1, "TH0001")).to.emit(market, "OrderShipped");
      const o = await market.getOrder(1);
      expect(o.status).to.equal(Status.Shipped);
      expect(o.trackingNo).to.equal("TH0001");
      expect(o.confirmDeadline).to.equal(o.shippedAt + BigInt(CONFIRM_WINDOW));
    });

    it("ผู้ซื้อยืนยันรับของ → ผู้ขายได้เงินหลังหักค่าธรรมเนียม 2%", async function () {
      const { market, seller, buyer } = await loadFixture(shippedFixture);
      const fee = (GPU_PRICE * BigInt(FEE_BPS)) / 10000n;
      await expect(market.connect(buyer).confirmReceived(1))
        .to.emit(market, "OrderCompleted")
        .withArgs(1, GPU_PRICE - fee, fee);

      expect((await market.getOrder(1)).status).to.equal(Status.Completed);
      expect(await market.pendingWithdrawals(seller.address)).to.equal(GPU_PRICE - fee);
      expect(await market.accumulatedFees()).to.equal(fee);
      expect(await market.totalEscrow()).to.equal(0);
      await expectSolvent(market, [seller.address, buyer.address]);
    });

    it("ตรวจสิทธิ์และลำดับขั้นตอน", async function () {
      const { market, seller, buyer, other } = await loadFixture(paidFixture);
      // คนอื่นแจ้งจัดส่งไม่ได้
      await expect(market.connect(other).markShipped(1, "X")).to.be.revertedWithCustomError(market, "NotOrderSeller");
      // ยืนยันรับของก่อนจัดส่งไม่ได้
      await expect(market.connect(buyer).confirmReceived(1))
        .to.be.revertedWithCustomError(market, "InvalidStatus")
        .withArgs(Status.Paid);
      // เลขพัสดุว่าง / ยาวเกิน
      await expect(market.connect(seller).markShipped(1, "")).to.be.revertedWithCustomError(market, "InvalidTracking");
      await expect(market.connect(seller).markShipped(1, "x".repeat(65))).to.be.revertedWithCustomError(
        market,
        "InvalidTracking"
      );

      await market.connect(seller).markShipped(1, "TH1");
      // แจ้งจัดส่งซ้ำไม่ได้
      await expect(market.connect(seller).markShipped(1, "TH2")).to.be.revertedWithCustomError(market, "InvalidStatus");
      // คนอื่นยืนยันแทนผู้ซื้อไม่ได้
      await expect(market.connect(other).confirmReceived(1)).to.be.revertedWithCustomError(market, "NotOrderBuyer");

      await market.connect(buyer).confirmReceived(1);
      // ยืนยันซ้ำไม่ได้
      await expect(market.connect(buyer).confirmReceived(1)).to.be.revertedWithCustomError(market, "InvalidStatus");
      // คำสั่งซื้อที่ไม่มี
      await expect(market.connect(buyer).confirmReceived(99)).to.be.revertedWithCustomError(market, "OrderNotFound");
    });
  });

  // ═══════════════════════════ คืนเงิน / ยกเลิก ═══════════════════════════

  describe("คืนเงินและยกเลิก", function () {
    it("ผู้ขายไม่ส่งของภายใน 3 วัน → ผู้ซื้อขอคืนเงินได้ และสต็อกถูกคืน", async function () {
      const { market, buyer, seller } = await loadFixture(paidFixture);
      await expect(market.connect(buyer).requestRefund(1)).to.be.revertedWithCustomError(market, "DeadlineNotReached");

      await time.increase(SHIP_WINDOW + 1);
      await expect(market.connect(buyer).requestRefund(1)).to.emit(market, "OrderRefunded").withArgs(1, GPU_PRICE);

      expect((await market.getOrder(1)).status).to.equal(Status.Refunded);
      expect(await market.pendingWithdrawals(buyer.address)).to.equal(GPU_PRICE);
      expect((await market.getProduct(1)).stock).to.equal(3);
      expect(await market.accumulatedFees()).to.equal(0);
      await expectSolvent(market, [seller.address, buyer.address]);
    });

    it("ผู้ขายแจ้งจัดส่งหลังพ้นกำหนดไม่ได้", async function () {
      const { market, seller } = await loadFixture(paidFixture);
      await time.increase(SHIP_WINDOW + 1);
      await expect(market.connect(seller).markShipped(1, "TH1")).to.be.revertedWithCustomError(market, "DeadlinePassed");
    });

    it("คนอื่นขอคืนเงินแทนผู้ซื้อไม่ได้ และขอคืนหลังจัดส่งแล้วไม่ได้", async function () {
      const { market, other } = await loadFixture(paidFixture);
      await time.increase(SHIP_WINDOW + 1);
      await expect(market.connect(other).requestRefund(1)).to.be.revertedWithCustomError(market, "NotOrderBuyer");

      const fresh = await loadFixture(shippedFixture);
      await time.increase(SHIP_WINDOW + 1);
      await expect(fresh.market.connect(fresh.buyer).requestRefund(1)).to.be.revertedWithCustomError(
        fresh.market,
        "InvalidStatus"
      );
    });

    it("ผู้ขายยกเลิกคำสั่งซื้อก่อนจัดส่ง → ผู้ซื้อได้เงินคืนเต็มจำนวน", async function () {
      const { market, seller, buyer, other } = await loadFixture(paidFixture);
      await expect(market.connect(other).cancelOrder(1)).to.be.revertedWithCustomError(market, "NotOrderSeller");
      await expect(market.connect(seller).cancelOrder(1)).to.emit(market, "OrderRefunded").withArgs(1, GPU_PRICE);
      expect(await market.pendingWithdrawals(buyer.address)).to.equal(GPU_PRICE);
      expect((await market.getProduct(1)).stock).to.equal(3);
    });

    it("ผู้ขายยกเลิกหลังจัดส่งแล้วไม่ได้", async function () {
      const { market, seller } = await loadFixture(shippedFixture);
      await expect(market.connect(seller).cancelOrder(1)).to.be.revertedWithCustomError(market, "InvalidStatus");
    });
  });

  // ═══════════════════════════ ผู้ขายรับเงินเอง ═══════════════════════════

  describe("ผู้ขายรับเงินเองเมื่อผู้ซื้อไม่ยืนยัน", function () {
    it("รับเงินได้หลังพ้น 7 วัน", async function () {
      const { market, seller } = await loadFixture(shippedFixture);
      await expect(market.connect(seller).claimPayment(1)).to.be.revertedWithCustomError(market, "DeadlineNotReached");

      await time.increase(CONFIRM_WINDOW + 1);
      await expect(market.connect(seller).claimPayment(1)).to.emit(market, "OrderCompleted");
      expect((await market.getOrder(1)).status).to.equal(Status.Completed);
    });

    it("คนอื่นกดรับเงินแทนผู้ขายไม่ได้ และรับเงินก่อนจัดส่งไม่ได้", async function () {
      const { market, seller, other } = await loadFixture(paidFixture);
      await expect(market.connect(seller).claimPayment(1)).to.be.revertedWithCustomError(market, "InvalidStatus");
      await market.connect(seller).markShipped(1, "TH1");
      await time.increase(CONFIRM_WINDOW + 1);
      await expect(market.connect(other).claimPayment(1)).to.be.revertedWithCustomError(market, "NotOrderSeller");
    });
  });

  // ═══════════════════════════ ข้อพิพาท ═══════════════════════════

  describe("ข้อพิพาท", function () {
    it("ผู้ซื้อเปิดข้อพิพาทได้หลังจัดส่ง", async function () {
      const { market, buyer } = await loadFixture(shippedFixture);
      const reason = ethers.id("ของไม่ตรงปก");
      await expect(market.connect(buyer).openDispute(1, reason)).to.emit(market, "DisputeOpened").withArgs(1, reason);
      const o = await market.getOrder(1);
      expect(o.status).to.equal(Status.Disputed);
      expect(o.disputeReasonHash).to.equal(reason);
    });

    it("เปิดข้อพิพาทก่อนจัดส่ง หลังพ้นกำหนด หรือโดยคนอื่นไม่ได้", async function () {
      const paid = await loadFixture(paidFixture);
      await expect(paid.market.connect(paid.buyer).openDispute(1, ethers.ZeroHash)).to.be.revertedWithCustomError(
        paid.market,
        "InvalidStatus"
      );

      const { market, buyer, other } = await loadFixture(shippedFixture);
      await expect(market.connect(other).openDispute(1, ethers.ZeroHash)).to.be.revertedWithCustomError(
        market,
        "NotOrderBuyer"
      );
      await time.increase(CONFIRM_WINDOW + 1);
      await expect(market.connect(buyer).openDispute(1, ethers.ZeroHash)).to.be.revertedWithCustomError(
        market,
        "DeadlinePassed"
      );
    });

    it("ระหว่างข้อพิพาท ผู้ขายรับเงินเองไม่ได้ และผู้ซื้อยืนยันไม่ได้", async function () {
      const { market, seller, buyer } = await loadFixture(disputedFixture);
      await time.increase(CONFIRM_WINDOW + 1);
      await expect(market.connect(seller).claimPayment(1)).to.be.revertedWithCustomError(market, "InvalidStatus");
      await expect(market.connect(buyer).confirmReceived(1)).to.be.revertedWithCustomError(market, "InvalidStatus");
    });

    it("Admin ตัดสินให้ผู้ซื้อ → คืนเงินเต็มจำนวน", async function () {
      const { market, admin, seller, buyer } = await loadFixture(disputedFixture);
      await expect(market.connect(admin).resolveDispute(1, true, "หลักฐานชัดเจน"))
        .to.emit(market, "DisputeResolved")
        .withArgs(1, true, "หลักฐานชัดเจน")
        .and.to.emit(market, "OrderRefunded");
      expect((await market.getOrder(1)).status).to.equal(Status.Refunded);
      expect(await market.pendingWithdrawals(buyer.address)).to.equal(GPU_PRICE);
      expect(await market.pendingWithdrawals(seller.address)).to.equal(0);
      await expectSolvent(market, [seller.address, buyer.address]);
    });

    it("Admin ตัดสินให้ผู้ขาย → จ่ายผู้ขายหลังหักค่าธรรมเนียม", async function () {
      const { market, admin, seller, buyer } = await loadFixture(disputedFixture);
      await expect(market.connect(admin).resolveDispute(1, false, "ผู้ขายส่งของถูกต้อง")).to.emit(
        market,
        "OrderCompleted"
      );
      const fee = (GPU_PRICE * BigInt(FEE_BPS)) / 10000n;
      expect((await market.getOrder(1)).status).to.equal(Status.Completed);
      expect(await market.pendingWithdrawals(seller.address)).to.equal(GPU_PRICE - fee);
      await expectSolvent(market, [seller.address, buyer.address]);
    });

    it("เฉพาะ Admin ตัดสินได้ และตัดสินได้เฉพาะคำสั่งซื้อที่มีข้อพิพาท", async function () {
      const { market, admin, buyer } = await loadFixture(disputedFixture);
      await expect(market.connect(buyer).resolveDispute(1, true, "")).to.be.revertedWithCustomError(
        market,
        "AccessControlUnauthorizedAccount"
      );
      await expect(market.connect(admin).resolveDispute(1, true, "x".repeat(281))).to.be.revertedWithCustomError(
        market,
        "InvalidNote"
      );
      await market.connect(admin).resolveDispute(1, true, "");
      await expect(market.connect(admin).resolveDispute(1, false, "")).to.be.revertedWithCustomError(
        market,
        "InvalidStatus"
      );
    });
  });

  // ═══════════════════════════ หลาย Admin (AccessControl) ═══════════════════════════

  describe("หลาย Admin", function () {
    it("ผู้ deploy ได้ทั้ง DEFAULT_ADMIN_ROLE และ ADMIN_ROLE และใส่ Admin เพิ่มตอน deploy ได้", async function () {
      const [admin, , , , other] = await ethers.getSigners();
      const factory = await ethers.getContractFactory("PCMarketplace");
      const market = await factory.deploy(FEE_BPS, SHIP_WINDOW, CONFIRM_WINDOW, [other.address]);
      const ADMIN_ROLE = await market.ADMIN_ROLE();
      expect(await market.hasRole(await market.DEFAULT_ADMIN_ROLE(), admin.address)).to.equal(true);
      expect(await market.hasRole(ADMIN_ROLE, admin.address)).to.equal(true);
      expect(await market.hasRole(ADMIN_ROLE, other.address)).to.equal(true);
      expect(await market.getAdmins()).to.deep.equal([admin.address, other.address]);
    });

    it("ปฏิเสธ address 0 ในรายชื่อ Admin ตอน deploy", async function () {
      const factory = await ethers.getContractFactory("PCMarketplace");
      await expect(factory.deploy(FEE_BPS, SHIP_WINDOW, CONFIRM_WINDOW, [ethers.ZeroAddress])).to.be.revertedWithCustomError(
        factory,
        "InvalidAddress"
      );
    });

    it("Admin คนที่สองทำหน้าที่ Admin ได้ทุกอย่าง เช่น ตัดสินข้อพิพาท", async function () {
      const { market, admin, buyer, other } = await loadFixture(disputedFixture);
      await market.connect(admin).grantRole(await market.ADMIN_ROLE(), other.address);
      await expect(market.connect(other).resolveDispute(1, true, "admin 2")).to.emit(market, "DisputeResolved");
      await expect(market.connect(other).setFee(300)).to.emit(market, "FeeUpdated").withArgs(300);
      expect(await market.pendingWithdrawals(buyer.address)).to.equal(GPU_PRICE);
    });

    it("เฉพาะ DEFAULT_ADMIN_ROLE เพิ่ม/ถอด Admin ได้ — Admin ทั่วไปเพิ่มคนอื่นไม่ได้", async function () {
      const { market, admin, seller, other } = await loadFixture(deployFixture);
      const ADMIN_ROLE = await market.ADMIN_ROLE();
      await market.connect(admin).grantRole(ADMIN_ROLE, other.address);
      await expect(market.connect(other).grantRole(ADMIN_ROLE, seller.address)).to.be.revertedWithCustomError(
        market,
        "AccessControlUnauthorizedAccount"
      );
      await expect(market.connect(admin).revokeRole(ADMIN_ROLE, other.address))
        .to.emit(market, "RoleRevoked")
        .withArgs(ADMIN_ROLE, other.address, admin.address);
      await expect(market.connect(other).pause()).to.be.revertedWithCustomError(market, "AccessControlUnauthorizedAccount");
      expect(await market.getAdmins()).to.deep.equal([admin.address]);
    });

    it("Admin สละสิทธิ์ตัวเองได้ (renounceRole)", async function () {
      const { market, admin, other } = await loadFixture(deployFixture);
      const ADMIN_ROLE = await market.ADMIN_ROLE();
      await market.connect(admin).grantRole(ADMIN_ROLE, other.address);
      await market.connect(other).renounceRole(ADMIN_ROLE, other.address);
      expect(await market.hasRole(ADMIN_ROLE, other.address)).to.equal(false);
    });
  });

  // ═══════════════════════════ Admin ═══════════════════════════

  describe("Admin", function () {
    it("ซ่อนสินค้า → ซื้อไม่ได้ / เลิกซ่อน → ซื้อได้", async function () {
      const { market, admin, buyer } = await loadFixture(listedFixture);
      await expect(market.connect(admin).setProductHidden(1, true)).to.emit(market, "ProductHidden").withArgs(1, true);
      await expect(
        market.connect(buyer).checkout([1], [1], { value: GPU_PRICE })
      ).to.be.revertedWithCustomError(market, "ProductUnavailable");
      await market.connect(admin).setProductHidden(1, false);
      await expect(market.connect(buyer).checkout([1], [1], { value: GPU_PRICE })).to.emit(market, "OrderPlaced");
    });

    it("แบนผู้ขาย → ลงขายใหม่ไม่ได้และสินค้าเดิมซื้อไม่ได้ แต่คำสั่งซื้อเดิมยังดำเนินต่อได้", async function () {
      const { market, admin, seller, buyer } = await loadFixture(paidFixture);
      await expect(market.connect(admin).setSellerBanned(seller.address, true))
        .to.emit(market, "SellerBanned")
        .withArgs(seller.address, true);
      expect((await market.getSellerInfo(seller.address)).banned).to.equal(true);

      await expect(
        market.connect(seller).listProduct("New", 0, 0, GPU_PRICE, 1, ethers.ZeroHash)
      ).to.be.revertedWithCustomError(market, "SellerIsBanned");
      await expect(
        market.connect(buyer).checkout([1], [1], { value: GPU_PRICE })
      ).to.be.revertedWithCustomError(market, "ProductUnavailable");

      // คำสั่งซื้อที่จ่ายไปแล้วยังจบได้ตามปกติ
      await market.connect(seller).markShipped(1, "TH1");
      await market.connect(buyer).confirmReceived(1);
      expect((await market.getOrder(1)).status).to.equal(Status.Completed);
    });

    it("ให้และถอนป้าย Verified", async function () {
      const { market, admin, seller } = await loadFixture(deployFixture);
      await expect(market.connect(admin).setSellerVerified(seller.address, true))
        .to.emit(market, "SellerVerified")
        .withArgs(seller.address, true);
      expect((await market.getSellerInfo(seller.address)).verified).to.equal(true);
      await market.connect(admin).setSellerVerified(seller.address, false);
      expect((await market.getSellerInfo(seller.address)).verified).to.equal(false);
    });

    it("ตั้งค่าธรรมเนียมได้ไม่เกิน 10% และตั้งระยะเวลาได้", async function () {
      const { market, admin } = await loadFixture(deployFixture);
      await expect(market.connect(admin).setFee(1000)).to.emit(market, "FeeUpdated").withArgs(1000);
      await expect(market.connect(admin).setFee(1001)).to.be.revertedWithCustomError(market, "InvalidFee");
      await expect(market.connect(admin).setDeadlines(120, 300))
        .to.emit(market, "DeadlinesUpdated")
        .withArgs(120, 300);
      await expect(market.connect(admin).setDeadlines(120, 0)).to.be.revertedWithCustomError(market, "InvalidWindow");
    });

    it("address 0 ใช้กับการแบน / Verified / ถอนค่าธรรมเนียมไม่ได้", async function () {
      const { market, admin } = await loadFixture(deployFixture);
      await expect(market.connect(admin).setSellerBanned(ethers.ZeroAddress, true)).to.be.revertedWithCustomError(
        market,
        "InvalidAddress"
      );
      await expect(market.connect(admin).setSellerVerified(ethers.ZeroAddress, true)).to.be.revertedWithCustomError(
        market,
        "InvalidAddress"
      );
      await expect(market.connect(admin).withdrawFees(ethers.ZeroAddress)).to.be.revertedWithCustomError(
        market,
        "InvalidAddress"
      );
    });

    it("ผู้ใช้ที่ไม่ใช่ Admin เรียกฟังก์ชัน Admin ไม่ได้", async function () {
      const { market, other } = await loadFixture(listedFixture);
      const o = market.connect(other);
      const calls = [
        () => o.setProductHidden(1, true),
        () => o.setSellerBanned(other.address, true),
        () => o.setSellerVerified(other.address, true),
        () => o.setFee(100),
        () => o.setDeadlines(60, 60),
        () => o.pause(),
        () => o.unpause(),
        () => o.withdrawFees(other.address),
      ];
      for (const call of calls) {
        await expect(call()).to.be.revertedWithCustomError(market, "AccessControlUnauthorizedAccount");
      }
    });

    it("Admin ถอนค่าธรรมเนียมได้เฉพาะส่วนที่สะสม ไม่แตะเงิน escrow", async function () {
      const { market, admin, seller, buyer, other } = await loadFixture(completedFixture);
      // มีคำสั่งซื้ออีกรายการที่ยังล็อกอยู่
      await market.connect(buyer).checkout([2], [1], { value: CPU_PRICE });
      const fee = (GPU_PRICE * BigInt(FEE_BPS)) / 10000n;

      const tx = market.connect(admin).withdrawFees(other.address);
      await expect(tx).to.changeEtherBalances([other, market], [fee, -fee]);
      await expect(tx).to.emit(market, "FeesWithdrawn").withArgs(other.address, fee);
      expect(await market.accumulatedFees()).to.equal(0);
      expect(await market.totalEscrow()).to.equal(CPU_PRICE);
      await expect(market.connect(admin).withdrawFees(other.address)).to.be.revertedWithCustomError(
        market,
        "NothingToWithdraw"
      );
      await expectSolvent(market, [seller.address, buyer.address]);
    });
  });

  // ═══════════════════════════ Pause ═══════════════════════════

  describe("Pause", function () {
    it("ตอน pause ลงขายและซื้อไม่ได้", async function () {
      const { market, admin, seller, buyer } = await loadFixture(listedFixture);
      await market.connect(admin).pause();
      await expect(
        market.connect(seller).listProduct("X", 0, 0, GPU_PRICE, 1, ethers.ZeroHash)
      ).to.be.revertedWithCustomError(market, "EnforcedPause");
      await expect(
        market.connect(buyer).checkout([1], [1], { value: GPU_PRICE })
      ).to.be.revertedWithCustomError(market, "EnforcedPause");

      await market.connect(admin).unpause();
      await expect(market.connect(buyer).checkout([1], [1], { value: GPU_PRICE })).to.emit(market, "OrderPlaced");
    });

    it("ตอน pause ยังจัดส่ง ยืนยันรับของ ขอคืนเงิน และถอนเงินได้", async function () {
      const { market, admin, seller, buyer } = await loadFixture(listedFixture);
      await market.connect(buyer).checkout([1, 2], [1, 1], { value: GPU_PRICE + CPU_PRICE });
      await market.connect(admin).pause();

      // order 1: จัดส่ง → ยืนยัน
      await market.connect(seller).markShipped(1, "TH1");
      await market.connect(buyer).confirmReceived(1);
      // order 2: ผู้ขายไม่ส่ง → ผู้ซื้อขอคืน
      await time.increase(SHIP_WINDOW + 1);
      await market.connect(buyer).requestRefund(2);

      await expect(market.connect(seller).withdraw()).to.emit(market, "Withdrawn");
      await expect(market.connect(buyer).withdraw()).to.changeEtherBalance(buyer, CPU_PRICE);
    });
  });

  // ═══════════════════════════ ถอนเงิน ═══════════════════════════

  describe("ถอนเงิน (Pull Payment)", function () {
    it("ถอนได้ยอดถูกต้อง และถอนซ้ำไม่ได้", async function () {
      const { market, seller } = await loadFixture(completedFixture);
      const amount = await market.pendingWithdrawals(seller.address);
      const tx = market.connect(seller).withdraw();
      await expect(tx).to.changeEtherBalances([seller, market], [amount, -amount]);
      await expect(tx).to.emit(market, "Withdrawn").withArgs(seller.address, amount);
      expect(await market.pendingWithdrawals(seller.address)).to.equal(0);
      await expect(market.connect(seller).withdraw()).to.be.revertedWithCustomError(market, "NothingToWithdraw");
    });

    it("คนที่ไม่มียอดถอนไม่ได้", async function () {
      const { market, other } = await loadFixture(deployFixture);
      await expect(market.connect(other).withdraw()).to.be.revertedWithCustomError(market, "NothingToWithdraw");
    });

    it("หลังทุกคนถอนครบ เงินใน contract เหลือ 0", async function () {
      const { market, admin, seller, seller2, buyer } = await loadFixture(listedFixture);
      await market.connect(buyer).checkout([1, 2], [2, 1], { value: GPU_PRICE * 2n + CPU_PRICE });
      await market.connect(seller).markShipped(1, "TH1");
      await market.connect(buyer).confirmReceived(1);
      await market.connect(seller2).cancelOrder(2);
      await expectSolvent(market, [seller.address, seller2.address, buyer.address]);

      await market.connect(seller).withdraw();
      await market.connect(buyer).withdraw();
      await market.connect(admin).withdrawFees(admin.address);
      expect(await ethers.provider.getBalance(await market.getAddress())).to.equal(0);
    });
  });

  // ═══════════════════════════ View ═══════════════════════════

  describe("ฟังก์ชันอ่านข้อมูล", function () {
    it("getProducts / getOrders แบ่งหน้าได้ถูกต้อง", async function () {
      const { market, buyer } = await loadFixture(listedFixture);
      expect(await market.getProducts(0, 10)).to.have.length(2);
      const page = await market.getProducts(1, 1);
      expect(page).to.have.length(1);
      expect(page[0].id).to.equal(2);
      expect(await market.getProducts(5, 10)).to.have.length(0);

      expect(await market.getOrders(0, 10)).to.have.length(0);
      await market.connect(buyer).checkout([1, 2], [1, 1], { value: GPU_PRICE + CPU_PRICE });
      const orders = await market.getOrders(0, 1);
      expect(orders).to.have.length(1);
      expect(orders[0].id).to.equal(1);
      expect(await market.getOrders(1, 10)).to.have.length(1);
    });

    it("getOrder ของคำสั่งซื้อที่ไม่มีจะ revert", async function () {
      const { market } = await loadFixture(deployFixture);
      await expect(market.getOrder(1)).to.be.revertedWithCustomError(market, "OrderNotFound");
    });
  });
});
