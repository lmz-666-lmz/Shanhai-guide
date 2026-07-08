import "./TwoDDigitalHuman.css";

export type TwoDDigitalHumanStatus = "idle" | "thinking" | "speaking" | "guiding";

export type TwoDDigitalHumanProps = {
  name: string;
  avatarText: string;
  roleTitle?: string;
  welcomeText?: string;
  stylePreset?: string;
  status?: TwoDDigitalHumanStatus;
  compact?: boolean;
};

const statusText: Record<TwoDDigitalHumanStatus, string> = {
  idle: "待机中",
  thinking: "正在思考",
  speaking: "正在讲解",
  guiding: "正在导览",
};

function presetClass(stylePreset?: string) {
  if (stylePreset === "校园清新") return "fresh";
  if (stylePreset === "文化典雅") return "classic";
  return "tech";
}

function TwoDDigitalHuman({
  name,
  avatarText,
  roleTitle = "校园 AI 导览员",
  welcomeText,
  stylePreset = "科技蓝紫",
  status = "idle",
  compact = false,
}: TwoDDigitalHumanProps) {
  return (
    <div className={`two-d-human ${presetClass(stylePreset)} ${status} ${compact ? "compact" : ""}`}>
      <div className="two-d-stage" aria-label={`${name} ${roleTitle}`}>
        <div className="two-d-orbit two-d-orbit-a"></div>
        <div className="two-d-orbit two-d-orbit-b"></div>
        <div className="two-d-spark spark-one"></div>
        <div className="two-d-spark spark-two"></div>
        <div className="two-d-spark spark-three"></div>
        <div className="two-d-guide-path">
          <span></span>
          <span></span>
          <span></span>
        </div>
        <div className="two-d-person">
          <div className="two-d-halo"></div>
          <div className="two-d-head">
            <div className="two-d-hair"></div>
            <div className="two-d-face">
              <div className="two-d-eye left"></div>
              <div className="two-d-eye right"></div>
              <div className="two-d-nose"></div>
              <div className="two-d-mouth"></div>
            </div>
            <div className="two-d-ear left"></div>
            <div className="two-d-ear right"></div>
          </div>
          <div className="two-d-neck"></div>
          <div className="two-d-body">
            <div className="two-d-collar"></div>
            <div className="two-d-badge">{avatarText || "海"}</div>
          </div>
        </div>
        <div className="two-d-wave wave-one"></div>
        <div className="two-d-wave wave-two"></div>
      </div>
      <div className="two-d-info">
        <div>
          <strong>{name || "小海"}</strong>
          <span>{roleTitle}</span>
        </div>
        <em>{statusText[status]}</em>
      </div>
      {welcomeText && <p className="two-d-welcome">{welcomeText}</p>}
    </div>
  );
}

export default TwoDDigitalHuman;
