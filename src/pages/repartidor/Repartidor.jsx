import React, { useEffect, useState } from "react";
import { Badge, Button } from "antd";
import {
  LogoutOutlined,
  CarOutlined,
  FileTextOutlined,
  MoneyCollectOutlined,
} from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import Entregas from "./Entregas";
import Resumenes from "../admin/Resumenes";
import Gastos from "../admin/Gastos";
import Loading from "../../components/Loading";

const Repartidor = () => {
  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState("");
  const [newNotifications, setNewNotifications] = useState(0);
  const [activeTab, setActiveTab] = useState("entregas");
  const [resumenNegocioId, setResumenNegocioId] = useState(null);
  const navigate = useNavigate();
  const tabs = ["entregas", "resumenes", "gastos"];
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  
  // Estados para el swipe
  const [touchStart, setTouchStart] = useState(null);
  const [touchEnd, setTouchEnd] = useState(null);
  
  // Distancia mínima para considerar un swipe
  const minSwipeDistance = 50;

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

    const checkIsMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };

    getUserInfo();
    checkIsMobile();

    window.addEventListener("nuevaVenta", handleNuevaVenta);
    window.addEventListener("resize", checkIsMobile);

    return () => {
      window.removeEventListener("nuevaVenta", handleNuevaVenta);
      window.removeEventListener("resize", checkIsMobile);
    };
  }, []);

  // Funciones para manejar el swipe
  // Se guarda tambien la coordenada Y: midiendo solo X, un scroll vertical
  // hecho en diagonal contaba como swipe y cambiaba de pestaña solo.
  const onTouchStart = (e) => {
    setTouchEnd(null);
    setTouchStart({
      x: e.targetTouches[0].clientX,
      y: e.targetTouches[0].clientY,
    });
  };

  const onTouchMove = (e) => {
    setTouchEnd({
      x: e.targetTouches[0].clientX,
      y: e.targetTouches[0].clientY,
    });
  };

  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return;

    const distance = touchStart.x - touchEnd.x;
    const distanciaVertical = Math.abs(touchStart.y - touchEnd.y);

    // Solo es swipe si el movimiento es claramente horizontal; si no, era
    // un scroll y no hay que cambiar de pestaña.
    if (distanciaVertical > Math.abs(distance)) return;

    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;

    if (isLeftSwipe) {
      const currentIndex = tabs.indexOf(activeTab);
      if (currentIndex < tabs.length - 1) {
        setActiveTab(tabs[currentIndex + 1]);
        if (tabs[currentIndex + 1] === "entregas") {
          resetNotifications();
        }
      }
    }
    if (isRightSwipe) {
      const currentIndex = tabs.indexOf(activeTab);
      if (currentIndex > 0) {
        setActiveTab(tabs[currentIndex - 1]);
        if (tabs[currentIndex - 1] === "entregas") {
          resetNotifications();
        }
      }
    }
  };

  // Función para resetear las notificaciones
  const resetNotifications = () => {
    setNewNotifications(0);
  };

  const handleOpenResumen = (negocioId) => {
    if (!negocioId) return;
    setResumenNegocioId(Number(negocioId));
    setActiveTab("resumenes");
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
          <div className="max-w-7xl mx-auto flex justify-between items-center px-2 sm:px-4 lg:px-8">
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
              {/* 44x44 minimo tactil: es la accion mas destructiva de la
                  pantalla (cierra la sesion en pleno reparto) y era el target
                  mas chico, pegado al borde. */}
              <Button
                type="text"
                icon={<LogoutOutlined />}
                onClick={handleLogout}
                danger
                aria-label="Cerrar sesión"
                style={{
                  width: 44,
                  height: 44,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              />
            </div>
          </div>
        </div>

        {/* Menú de navegación */}
        <nav className="max-w-7xl mx-auto px-2 sm:px-4 lg:px-8">
          {/* gap-1: las 3 tabs eran adyacentes (separacion 0) y el dedo caia
              facil en la equivocada. */}
          <div className="flex gap-1 px-1">
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
            <button
              onClick={() => setActiveTab("gastos")}
              className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 font-medium transition-all border-b-2 ${
                activeTab === "gastos"
                  ? "text-blue-600 border-blue-600 bg-blue-50"
                  : "text-gray-500 border-transparent hover:text-gray-700 hover:bg-gray-50"
              }`}
            >
              <MoneyCollectOutlined />
              <span>Gastos</span>
            </button>
          </div>
        </nav>
      </header>

      <main 
        className="max-w-7xl mx-auto py-4 px-2 sm:px-4 lg:px-8"
        onTouchStart={isMobile ? onTouchStart : undefined}
        onTouchMove={isMobile ? onTouchMove : undefined}
        onTouchEnd={isMobile ? onTouchEnd : undefined}
        style={{
          // pan-y: el navegador maneja el scroll vertical y no aplica su
          // rebote horizontal sobre esta zona.
          touchAction: isMobile ? "pan-y" : "auto",
          overscrollBehaviorX: "contain",
        }}
      >
        {activeTab === "entregas" ? (
          <Entregas onOpenResumen={handleOpenResumen} />
        ) : activeTab === "resumenes" ? (
          <Resumenes preselectNegocioId={resumenNegocioId} />
        ) : (
          <Gastos />
        )}
      </main>
    </div>
  );
};

export default Repartidor;
