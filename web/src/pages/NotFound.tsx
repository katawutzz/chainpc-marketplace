import { Link } from "react-router-dom";
import { EmptyState } from "../components/ui";

export function NotFound() {
  return (
    <EmptyState icon="🧭" title="ไม่พบหน้านี้">
      <Link to="/" className="text-sky-700 hover:underline">
        กลับไปหน้าแรก
      </Link>
    </EmptyState>
  );
}
