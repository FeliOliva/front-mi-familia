import axios from "axios";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000/api";

export const api = async (endpoint, method = "GET", body = null) => {
  const token = sessionStorage.getItem("token");

  const config = {
    url: `${API_URL}/${endpoint}`,
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: token ? `Bearer ${token}` : "",
    },
  };

  if (body && !["GET", "DELETE"].includes(method)) {
    config.data = body;
  }

  try {
    const response = await axios(config);
    return response.data;
  } catch (error) {
    console.error("API Error:", error.response || error.message);
    throw new Error(error.response?.data?.message || "Error en la petición");
  }
};
