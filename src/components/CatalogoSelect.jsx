import React, { useEffect, useMemo, useState } from "react";
import { Select, Button, Divider, message } from "antd";
import { PlusOutlined } from "@ant-design/icons";
import { api } from "../services/api";

// Cache por endpoint para no pedir la misma lista en cada modal.
const cache = {};

const normalizar = (s) =>
  String(s || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .replace(/\s+/g, " ")
    .toUpperCase();

// Distancia de edicion (Levenshtein), para detectar variantes mal escritas.
const distancia = (a, b) => {
  const dp = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = dp[j];
      dp[j] = Math.min(
        dp[j] + 1,
        dp[j - 1] + 1,
        prev + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
      prev = tmp;
    }
  }
  return dp[b.length];
};

/**
 * Select de un catalogo (bancos, motivos de gasto).
 *
 * - Todos eligen de la lista, con busqueda.
 * - Admin (rol 0) y encargado (rol 1) pueden agregar un valor nuevo desde el
 *   mismo desplegable. Si lo que escriben se parece a uno existente (GASOLI vs
 *   COMBUSTIBLE no, pero GALICA vs GALICIA si), se sugiere el existente.
 *
 * Funciona como control de Form.Item: recibe value (id) y onChange(id).
 */
const CatalogoSelect = ({ endpoint, placeholder, value, onChange, ...rest }) => {
  const [items, setItems] = useState(cache[endpoint] || []);
  const [loading, setLoading] = useState(!cache[endpoint]);
  const [busqueda, setBusqueda] = useState("");
  const [creando, setCreando] = useState(false);
  const rol = Number(localStorage.getItem("rol"));
  const puedeAgregar = rol === 0 || rol === 1;

  useEffect(() => {
    let vivo = true;
    api(`api/${endpoint}`)
      .then((data) => {
        cache[endpoint] = data;
        if (vivo) setItems(data);
      })
      .catch(() => message.error("No se pudo cargar la lista"))
      .finally(() => vivo && setLoading(false));
    return () => {
      vivo = false;
    };
  }, [endpoint]);

  const texto = normalizar(busqueda);
  const existeExacto = items.some((i) => normalizar(i.nombre) === texto);
  // Parecidos: distancia chica o uno contiene al otro.
  const parecidos = useMemo(() => {
    if (!texto || existeExacto) return [];
    return items.filter((i) => {
      const n = normalizar(i.nombre);
      return (
        n.includes(texto) ||
        texto.includes(n) ||
        distancia(n, texto) <= Math.max(1, Math.floor(n.length / 4))
      );
    });
  }, [items, texto, existeExacto]);

  const agregar = async () => {
    if (!texto) return;
    setCreando(true);
    try {
      const nuevo = await api(`api/${endpoint}`, "POST", { nombre: texto });
      const lista = [...items.filter((i) => i.id !== nuevo.id), nuevo].sort(
        (a, b) => a.nombre.localeCompare(b.nombre),
      );
      cache[endpoint] = lista;
      setItems(lista);
      onChange?.(nuevo.id);
      setBusqueda("");
      message.success(`"${nuevo.nombre}" agregado`);
    } catch {
      message.error("No se pudo agregar");
    } finally {
      setCreando(false);
    }
  };

  return (
    <Select
      showSearch
      allowClear
      loading={loading}
      placeholder={placeholder}
      value={value ?? undefined}
      onChange={(v) => onChange?.(v ?? null)}
      searchValue={busqueda}
      onSearch={setBusqueda}
      optionFilterProp="label"
      filterOption={(input, option) =>
        normalizar(option?.label).includes(normalizar(input))
      }
      options={items.map((i) => ({ value: i.id, label: i.nombre }))}
      notFoundContent={
        loading
          ? "Cargando..."
          : puedeAgregar
            ? "Sin coincidencias"
            : "No está en la lista. Borrá la búsqueda para ver todas las opciones, o elegí OTRO y escribilo en el detalle."
      }
      dropdownRender={(menu) => (
        <>
          {menu}
          {puedeAgregar && texto && !existeExacto && (
            <>
              <Divider style={{ margin: "6px 0" }} />
              <div style={{ padding: "4px 8px" }}>
                {parecidos.length > 0 && (
                  <div style={{ fontSize: 12, color: "#d46b08", marginBottom: 6 }}>
                    ¿Quisiste decir{" "}
                    {parecidos.slice(0, 3).map((p, i) => (
                      <React.Fragment key={p.id}>
                        {i > 0 && ", "}
                        <a
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => {
                            onChange?.(p.id);
                            setBusqueda("");
                          }}
                        >
                          {p.nombre}
                        </a>
                      </React.Fragment>
                    ))}
                    ?
                  </div>
                )}
                <Button
                  type="dashed"
                  icon={<PlusOutlined />}
                  block
                  loading={creando}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={agregar}
                >
                  Agregar "{texto}"
                </Button>
              </div>
            </>
          )}
        </>
      )}
      {...rest}
    />
  );
};

export default CatalogoSelect;
