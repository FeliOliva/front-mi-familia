import React, { useEffect, useState } from "react";
import { Badge, Button } from "antd";
import { LogoutOutlined } from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import Entregas from "./Entregas";
import Loading from "../../components/Loading";

const Repartidor = () => {
  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState("");
  const [newNotifications, setNewNotifications] = useState(0);
  const navigate = useNavigate();

  useEffect(() => {
    const getUserInfo = () => {
      try {
        const storedUserName = sessionStorage.getItem("userName");
        setUserName(storedUserName || "Repartidor");
      } catch (error) {
        console.error("Error obteniendo nombre del usuario:", error);
        setUserName("Repartidor");
      } finally {
        setLoading(false);
      }
    };

    const handleNuevaVenta = () => {
      setNewNotifications(prev => prev + 1);
    };

    getUserInfo();

    window.addEventListener('nuevaVenta', handleNuevaVenta);

    return () => {
      window.removeEventListener('nuevaVenta', handleNuevaVenta);
    };
  }, []);

  // Función para resetear las notificaciones
  const resetNotifications = () => {
    setNewNotifications(0);
  };

  // Función para cerrar sesión
  const handleLogout = () => {
    sessionStorage.clear();
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
      <header className="bg-white shadow-md p-4 sticky top-0 z-10">
        <div className="max-w-lg mx-auto flex justify-between items-center">
          <div className="flex items-center gap-2">
            <img src="/logo.png" alt="Mi Familia" className="h-6 w-auto" />
            <h1 className="text-xl font-bold text-blue-700">Mi Familia</h1>
          </div>
          <div className="flex items-center gap-3">
            <Badge count={newNotifications} offset={[-5, 0]}>
              <div className="text-gray-700 font-medium ">¡Hola, {userName}!</div>
            </Badge>
            <Button
              type="default"
              icon={<LogoutOutlined />}
              onClick={handleLogout}
              size="small"
            >
              Cerrar sesión
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-lg mx-auto py-4" onClick={resetNotifications}>
        <Entregas />
      </main>
    </div>
  );
};

export default Repartidor;