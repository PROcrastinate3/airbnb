export const money = (n, currency = "PHP") =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: n % 1 === 0 ? 0 : 2,
  }).format(n || 0);

export const fmtDate = (
  d,
  opts = { month: "short", day: "numeric", year: "numeric" },
) => (d ? new Date(d).toLocaleDateString("en-US", opts) : "");

//loc
// "Brgy. Catangnan, General Luna, Surigao del Norte"
export const areaLine = (l) =>
  [l?.location, l?.province]
    .filter((v, i, a) => v && a.indexOf(v) === i)
    .join(", ");

// "Tourism Road, Brgy. Catangnan, General Luna, Surigao del Norte 8419, Philippines"
export const fullAddress = (l) => {
  if (!l) return "";
  const region = [l.province, l.postalCode].filter(Boolean).join(" ");
  return [l.street, l.neighborhood, l.city, region, l.country]
    .filter(Boolean)
    .join(", ");
};

export const todayISO = () => new Date().toISOString().slice(0, 10);

export const addDaysISO = (iso, n) => {
  const d = new Date(iso);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

export const statusStyles = {
  confirmed: "bg-green-100 text-green-800",
  completed: "bg-gray-100 text-gray-700",
  pending: "bg-amber-100 text-amber-800",
  pending_payment: "bg-amber-100 text-amber-800",
  cancelled: "bg-red-100 text-red-700",
  published: "bg-green-100 text-green-800",
  rejected: "bg-red-100 text-red-700",
  suspended: "bg-red-100 text-red-700",
  active: "bg-green-100 text-green-800",
  succeeded: "bg-green-100 text-green-800",
  refunded: "bg-blue-100 text-blue-800",
  paid: "bg-green-100 text-green-800",
  partially_refunded: "bg-blue-100 text-blue-800",
  hidden: "bg-gray-200 text-gray-700",
  visible: "bg-green-100 text-green-800",
  approved: "bg-green-100 text-green-800",
  deactivated: "bg-red-100 text-red-700",
  unlisted: "bg-gray-100 text-gray-700",
  scheduled: "bg-amber-100 text-amber-800",
};

export const timeAgo = (iso) => {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  if (s < 86400 * 30) return `${Math.floor(s / 86400)} d ago`;
  return fmtDate(iso);
};

export const fmtTime = (hhmm) => {
  if (!hhmm) return "";
  const [h, m] = hhmm.split(":").map(Number);
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
};
