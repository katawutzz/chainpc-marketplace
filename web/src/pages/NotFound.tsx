import { Link } from "react-router-dom";
import { Compass } from "lucide-react";
import { EmptyState } from "../components/ui";

export function NotFound() {
  return (
    <EmptyState icon={Compass} title="ไม่พบหน้านี้">
      <Link to="/" className="text-brand-600 hover:underline">
        กลับไปหน้าแรก
      </Link>
    </EmptyState>
  );
}
