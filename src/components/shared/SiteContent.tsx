// Admin-managed site content shown to passengers/operators: announcements
// (a callout strip) and placement banners. One language at a time — each
// record carries both, and only the active UI language is rendered.
import { Link } from "react-router-dom";

import { usePublicAnnouncements, usePublicBanners } from "../../api/content";
import { useLocale } from "../../context/LocaleContext";
import type { Banner } from "../../types/admin";

export function SiteAnnouncements({ audience }: { audience: "passengers" | "operators" }) {
  const { language } = useLocale();
  const { data } = usePublicAnnouncements(audience);
  if (!data?.length) return null;
  return (
    <div>
      {data.map((a) => (
        <div
          key={a.public_id}
          role={a.severity === "warning" ? "alert" : "status"}
          className={`px-3 py-2 small border-bottom ${a.severity === "warning" ? "bg-warning-subtle text-warning-emphasis" : "bg-info-subtle text-info-emphasis"}`}
        >
          {language === "km" ? a.message_km : a.message_en}
        </div>
      ))}
    </div>
  );
}

function BannerCard({ banner }: { banner: Banner }) {
  const { language } = useLocale();
  const title = language === "km" ? banner.title_km : banner.title_en;
  const body = language === "km" ? banner.body_km : banner.body_en;
  const content = (
    <div
      className={`rounded-3 p-3 h-100 position-relative overflow-hidden${banner.image ? " bbms-site-banner-image" : ""}`}
      style={
        banner.image
          ? { backgroundImage: `url(${banner.image})`, color: "#fff" }
          : { backgroundColor: banner.background_color, color: "#fff" }
      }
    >
      <div className="position-relative">
        <strong className="d-block fs-5">{title}</strong>
        {body && <span>{body}</span>}
      </div>
    </div>
  );
  if (!banner.link_url) return content;
  return banner.link_url.startsWith("/") ? (
    <Link to={banner.link_url} className="text-decoration-none">{content}</Link>
  ) : (
    <a href={banner.link_url} className="text-decoration-none" rel="noreferrer">{content}</a>
  );
}

export function BannerStrip({ placement }: { placement: Banner["placement"] }) {
  const { data } = usePublicBanners(placement);
  if (!data?.length) return null;
  return (
    <div className="row g-3 my-3">
      {data.map((banner) => (
        <div key={banner.public_id} className={data.length === 1 ? "col-12" : "col-md-6"}>
          <BannerCard banner={banner} />
        </div>
      ))}
    </div>
  );
}
