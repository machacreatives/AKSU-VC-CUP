import { Department } from "@/lib/types";

export default function DeptBadge({
  department,
  size = 24,
}: {
  department: Department;
  size?: number;
}) {
  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-full font-semibold text-[0.55em] leading-none"
      style={{
        width: size,
        height: size,
        backgroundColor: `${department.color}1F`,
        color: department.color,
        border: `1px solid ${department.color}55`,
        fontSize: size * 0.38,
      }}
      aria-hidden="true"
    >
      {department.shortName.slice(0, 3)}
    </div>
  );
}
