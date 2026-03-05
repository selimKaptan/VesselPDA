import { NAV_CATEGORIES, getVisibleCategories, type NavCategory } from "@/lib/nav-categories";

interface IconRailProps {
  activeCategory: string;
  onCategoryChange: (key: string) => void;
  userRole: string;
  isAdmin: boolean;
}

function RailButton({
  cat,
  isActive,
  onClick,
}: {
  cat: NavCategory;
  isActive: boolean;
  onClick: () => void;
}) {
  const Icon = cat.icon;
  const isAmber = cat.color === "amber";

  const activeClass = isAmber
    ? "bg-amber-500/15 text-amber-400 shadow-inner shadow-amber-500/10 border border-amber-500/20"
    : "bg-sky-500/15 text-sky-400 shadow-inner shadow-sky-500/10 border border-sky-500/20";
  const normalClass = isAmber
    ? "text-amber-600 hover:bg-slate-800 hover:text-amber-300 hover:scale-105"
    : "text-slate-500 hover:bg-slate-800 hover:text-white hover:scale-105";

  return (
    <button
      onClick={onClick}
      title={cat.label}
      data-testid={`rail-${cat.key}`}
      className={`w-11 h-11 rounded-xl flex flex-col items-center justify-center gap-0.5 transition-all duration-150 cursor-pointer flex-shrink-0 ${
        isActive ? activeClass : normalClass
      }`}
    >
      <Icon className="w-5 h-5" />
      <span className="text-[8px] font-medium leading-none">{cat.abbrev}</span>
    </button>
  );
}

export function IconRail({ activeCategory, onCategoryChange, userRole, isAdmin }: IconRailProps) {
  const visibleCats = getVisibleCategories(userRole);

  const topCats = visibleCats.filter(
    (c) => c.key !== "admin" && c.key !== "settings"
  );
  const adminCat = isAdmin ? NAV_CATEGORIES.find((c) => c.key === "admin") : null;
  const settingsCat = NAV_CATEGORIES.find((c) => c.key === "settings");

  return (
    <aside className="w-16 flex-shrink-0 bg-[#080c18] border-r border-slate-700/30 hidden md:flex flex-col items-center py-3 gap-1 overflow-y-auto sidebar-scroll">
      {topCats.map((cat) => (
        <RailButton
          key={cat.key}
          cat={cat}
          isActive={activeCategory === cat.key}
          onClick={() => onCategoryChange(cat.key)}
        />
      ))}

      {/* Spacer pushes admin + settings to bottom */}
      <div className="flex-1" />

      {adminCat && (
        <RailButton
          cat={adminCat}
          isActive={activeCategory === adminCat.key}
          onClick={() => onCategoryChange(adminCat.key)}
        />
      )}
      {settingsCat && visibleCats.find((c) => c.key === "settings") && (
        <RailButton
          cat={settingsCat}
          isActive={activeCategory === settingsCat.key}
          onClick={() => onCategoryChange(settingsCat.key)}
        />
      )}
    </aside>
  );
}
