import axios from "axios";
import { message } from "antd";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000/api";

export const api = async (endpoint, method = "GET", body = null) => {
  const token = localStorage.getItem("token");

  const config = {
    url: `${API_URL}/${endpoint}`,
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  };

  if (body && !["GET", "DELETE"].includes(method)) {
    config.data = body;
  }

  try {
    const response = await axios(config);
    return response.data;
  } catch (error) {
    const res = error.response;

    // Si hay respuesta del server
    if (res) {
      const status = res.status;
      const data = res.data || {};

      // 🔐 Manejo centralizado de auth
      if (status === 401) {
        const code = data.code;

        if (code === "TOKEN_EXPIRED") {
          message.error("Tu sesión expiró. Vuelve a iniciar sesión.");
        } else if (code === "NO_TOKEN") {
          message.error("No estás autenticado. Inicia sesión.");
        } else if (code === "TOKEN_INVALID") {
          message.error("Sesión inválida. Inicia sesión nuevamente.");
        } else {
          message.error(data.message || data.error || "No autorizado.");
        }

        // Limpiamos todo lo relacionado a sesión
        localStorage.removeItem("token");
        localStorage.removeItem("tokenExpiry");
        localStorage.removeItem("rol");
        localStorage.removeItem("cajaId");
        localStorage.removeItem("userName");
        localStorage.removeItem("usuarioId");

        // Redirigir a login (ajusta el path si tu ruta es otra)
        window.location.href = "/login";

        // Importante: lanzamos un error para que quien llame sepa que falló
        throw new Error("UNAUTHORIZED");
      }

      // Otros errores (400, 404, 500, etc.)
      console.error("API Error:", res.status, data);
      throw new Error(data.message || data.error || "Error en la petición");
    }

    // Si no hay response (problemas de red, CORS, etc.)
    console.error("API Error sin respuesta:", error.message);
    throw new Error("Error de conexión con el servidor");
  }
};
