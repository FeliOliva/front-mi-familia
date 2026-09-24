import React, { useEffect, useState } from "react";

const MOBILE_QUERY = "(max-width: 767px)";

export const kbdStyle = {
  background: "#f0f0f0",
  padding: "2px 6px",
  borderRadius: 4,
  border: "1px solid #d9d9d9",
};

/**
 * Footer de modal con ayuda de atajos de teclado opcional.
 *
 * Reemplaza el patron anterior (un <span style={{float: "left"}}> dentro del
 * array `footer` de AntD): en pantallas angostas el float le quitaba ancho a
 * los botones y Cancelar / Guardar terminaban en renglones distintos.
 *
 * - Escritorio: ayuda a la izquierda, botones a la derecha.
 * - Mobile: sin ayuda (los atajos F2/F4 no existen en un telefono) y los
 *   botones ocupan toda la fila en partes iguales.
 *
 * `hint`: ayuda de atajos, solo escritorio.
 * `info`: dato que se muestra siempre (en mobile, arriba de los botones).
 */
const ModalFooter = ({ hint, info, children }) => {
  const [isMobile, setIsMobile] = useState(
    () => window.matchMedia(MOBILE_QUERY).matches,
  );

  useEffect(() => {
    const mq = window.matchMedia(MOBILE_QUERY);
    const onChange = (e) => setIsMobile(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const botones = React.Children.toArray(children).filter(Boolean);

  if (isMobile) {
    return (
      <div>
        {info && (
          <div
            style={{
              color: "#888",
              fontSize: 13,
              textAlign: "left",
              marginBottom: 8,
            }}
          >
            {info}
          </div>
        )}
        <div style={{ display: "flex", gap: 8, width: "100%" }}>
          {botones.map((btn) =>
            React.cloneElement(btn, {
              size: "large",
              style: { ...btn.props.style, flex: 1, minWidth: 0, margin: 0 },
            }),
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
      }}
    >
      <span style={{ color: "#888", fontSize: 12, textAlign: "left" }}>
        {info}
        {info && hint ? " · " : null}
        {hint ? <>💡 {hint}</> : null}
      </span>
      <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>{botones}</div>
    </div>
  );
};

export default ModalFooter;
