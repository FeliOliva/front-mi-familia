import React, { useEffect, useState } from "react";
import { Badge, Button } from "antd";
import {
  LogoutOutlined,
  CarOutlined,
  FileTextOutlined,
} from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import Entregas from "./Entregas";
import Resumenes from "../admin/Resumenes";
import Loading from "../../components/Loading";

const Repartidor = () => {
  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState("");
  const [newNotifications, setNewNotifications] = useState(0);
  const [activeTab, setActiveTab] = useState("entregas");
  const navigate = useNavigate();

  useEffect(() => {
    const getUserInfo = () => {
      try {
        const storedUserName = localStorage.getItem("userName");
        setUserName(storedUserName || "Repartidor");
      } catch (error) {
        console.error("Error obteniendo nombre del usuario:", error);
        setUserName("Repartidor");
      } finally {
        setLoading(false);
      }
    };

    const handleNuevaVenta = () => {
      setNewNotifications((prev) => prev + 1);
    };

    getUserInfo();

    window.addEventListener("nuevaVenta", handleNuevaVenta);

    return () => {
      window.removeEventListener("nuevaVenta", handleNuevaVenta);
    };
  }, []);

  // Función para resetear las notificaciones
  const resetNotifications = () => {
    setNewNotifications(0);
  };

  // Función para cerrar sesión
  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("tokenExpiry");
    localStorage.removeItem("rol");
    localStorage.removeItem("cajaId");
    localStorage.removeItem("userName");
    localStorage.removeItem("usuarioId");
    navigate("/login");
    window.location.href = "/login";
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center">
        <Loading />
      </div>
    );
  }

  return (
    <div className="repartidor-container bg-gray-50 min-h-screen">
      <header className="bg-white shadow-md sticky top-0 z-10">
        {/* Barra superior con logo y usuario */}
        <div className="p-3 border-b border-gray-100">
          <div className="max-w-4xl mx-auto flex justify-between items-center">
            <div className="flex items-center gap-2">
              <img src="/logo.png" alt="Mi Familia" className="h-6 w-auto" />
              <h1 className="text-lg font-bold text-blue-700">Mi Familia</h1>
            </div>
            <div className="flex items-center gap-2">
              <Badge count={newNotifications} offset={[-5, 0]}>
                <span className="text-gray-600 text-sm hidden sm:inline">
                  ¡Hola, {userName}!
                </span>
              </Badge>
              <Button
                type="text"
                icon={<LogoutOutlined />}
                onClick={handleLogout}
                size="small"
                danger
              />
            </div>
          </div>
        </div>

        {/* Menú de navegación */}
        <nav className="max-w-4xl mx-auto">
          <div className="flex">
            <button
              onClick={() => {
                setActiveTab("entregas");
                resetNotifications();
              }}
              className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 font-medium transition-all border-b-2 ${
                activeTab === "entregas"
                  ? "text-blue-600 border-blue-600 bg-blue-50"
                  : "text-gray-500 border-transparent hover:text-gray-700 hover:bg-gray-50"
              }`}
            >
              <CarOutlined />
              <span>Entregas</span>
              {newNotifications > 0 && activeTab !== "entregas" && (
                <span className="bg-red-500 text-white text-xs rounded-full px-1.5 py-0.5 min-w-[18px]">
                  {newNotifications}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab("resumenes")}
              className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 font-medium transition-all border-b-2 ${
                activeTab === "resumenes"
                  ? "text-blue-600 border-blue-600 bg-blue-50"
                  : "text-gray-500 border-transparent hover:text-gray-700 hover:bg-gray-50"
              }`}
            >
              <FileTextOutlined />
              <span>Resúmenes</span>
            </button>
          </div>
        </nav>
      </header>

      <main className="max-w-4xl mx-auto py-4 px-2">
        {activeTab === "entregas" ? <Entregas /> : <Resumenes />}
      </main>
    </div>
  );
};

export default Repartidor;