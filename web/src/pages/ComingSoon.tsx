import { Link } from "react-router-dom";
import { EmptyState } from "../components/ui";

/** หน้าที่ยังไม่ได้ทำ (ระยะ 6–7 ตาม docs/SCOPE.md) */
export function ComingSoon({ title, phase }: { title: string; phase: number }) {
  return (
    <EmptyState icon="🚧" title={title}>
      หน้านี้จะทำในระยะ {phase} ตามแผนใน SCOPE.md
      <Link to="/" className="mt-3 block text-sky-700 hover:underline">
        กลับไปเลือกซื้อสินค้า
      </Link>
    </EmptyState>
  );
}

export function NotFound() {
  return (
    <EmptyState icon="🧭" title="ไม่พบหน้านี้">
      <Link to="/" className="text-sky-700 hover:underline">
        กลับไปหน้าแรก
      </Link>
    </EmptyState>
  );
}
