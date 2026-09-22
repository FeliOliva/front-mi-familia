import React from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import Login from "../pages/Login";
import Ventas from "../pages/admin/Ventas";
import Productos from "../pages/admin/Productos";
import Negocios from "../pages/admin/Negocios";
import Resumenes from "../pages/admin/Resumenes";
import Pedidos from "../pages/admin/Pedidos";
import Presupuestos from "../pages/admin/Presupuestos";
import Repartidor from "../pages/repartidor/Repartidor";
import Unauthorized from "../pages/Unauthorized";
import Entregas from "../pages/repartidor/Entregas";
import MainLayout from "../components/layout/Sidebar"; // Ajusta el path si es necesario
import Caja from "../pages/admin/Caja";
import Gastos from "../pages/admin/Gastos";
import Cheques from "../pages/admin/Cheques";
import Estadisticas from "../pages/admin/Estadisticas";
// import EntregaEncargado from "../pages/encargadoVenta/EntregaEncargado";
// import CierreCajaEncargado from "../pages/encargadoVenta/cierreCaja";

const AppRouter = () => {
  const token = localStorage.getItem("token");
  const expiry = localStorage.getItem("tokenExpiry");
  const userRole = Number(localStorage.getItem("rol"));
  const now = Date.now();

  const isAuthenticated = token && expiry && now < Number(expiry);
  
  // Limpiar localStorage si el token expiró
  if (token && expiry && now >= Number(expiry)) {
    localStorage.removeItem("token");
    localStorage.removeItem("tokenExpiry");
    localStorage.removeItem("rol");
    localStorage.removeItem("cajaId");
    localStorage.removeItem("userName");
    localStorage.removeItem("usuarioId");
  }

  // Definir permisos por rol
  const isAdmin = userRole === 0;
  const isEncargadoVentas = userRole === 1; // <--- NUEVO
  const isDelivery = userRole >= 2 && userRole !== 3; // solo para repartidor


  return (
    <Router>
      <Routes>
        {isAuthenticated ? (
          <>
            {isDelivery ? (
              // El repartidor va SIEMPRE a su vista, sin importar el ancho de
              // pantalla: antes la condicion incluia `&& isMobile`, asi que en
              // desktop (o al girar a horizontal / usar tablet) caia en la rama
              // del panel y solo lo frenaba un catch-all de Unauthorized.
              // No tiene acceso a ventas ni a ninguna otra seccion del panel.
              <>
                <Route path="/repartidor" element={<Repartidor />} />
                <Route path="*" element={<Navigate to="/repartidor" replace />} />
              </>
            ) : (
              // Vista escritorio (admin, manager o encargado de ventas)
              <Route path="/" element={<MainLayout />}>
                <Route index element={<Navigate to={"/ventas"} />} />

                {isAdmin && (
                  <>
                    <Route path="productos" element={<Productos />} />
                    <Route path="negocios" element={<Negocios />} />
                    <Route path="resumenes" element={<Resumenes />} />
                    <Route path="ventas" element={<Ventas />} />
                    <Route path="caja" element={<Caja />} />
                    <Route path="pedidos" element={<Pedidos />} />
                    <Route path="presupuestos" element={<Presupuestos />} />
                    <Route path="gastos" element={<Gastos />} />
                    <Route path="cheques" element={<Cheques />} />
                    <Route path="estadisticas" element={<Estadisticas />} />
                  </>
                )}

                {isEncargadoVentas && (
                  <>
                    <Route path="productos" element={<Productos />} />
                    <Route path="negocios" element={<Negocios />} />
                    <Route path="ventas" element={<Ventas />} />
                    <Route path="presupuestos" element={<Presupuestos />} />
                    {/* <Route
                      path="cierre-caja"
                      element={<CierreCajaEncargado />}
                    /> */}
                    <Route path="resumenes" element={<Resumenes />} />
                    <Route path="gastos" element={<Gastos />} />
                    <Route path="cheques" element={<Cheques />} />
                    <Route path="*" element={<Navigate to="/ventas" />} />
                  </>
                )}

                {/* Ya no hace falta la rama de "delivery en escritorio": esta
                    seccion solo se monta para roles que no son repartidor. */}

                {/* Si no tiene permisos */}
                {!(isAdmin || isEncargadoVentas || isDelivery) && (
                  <>
                    <Route path="productos" element={<Unauthorized />} />
                    <Route path="negocios" element={<Unauthorized />} />
                    <Route path="resumenes" element={<Unauthorized />} />
                    <Route path="ventas" element={<Unauthorized />} />
                    <Route path="caja" element={<Unauthorized />} />
                  </>
                )}

                <Route path="*" element={<Navigate to="/ventas" />} />
              </Route>
            )}
          </>
        ) : (
          // No autenticado
          <>
            <Route path="/login" element={<Login />} />
            <Route path="*" element={<Navigate to="/login" />} />
          </>
        )}
      </Routes>
    </Router>
  );
};

export default AppRouter;
