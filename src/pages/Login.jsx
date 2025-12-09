import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Form, Input, Button, message, Card } from "antd";

const Login = () => {
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const API_URL = import.meta.env.VITE_API_URL;

  const onFinish = async (values) => {
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });

      const data = await response.json();
      if (!response.ok)
        throw new Error(data.message || "Error en la autenticación");

      // Duración del token: 8 horas (debe coincidir con el backend)
      const TOKEN_DURATION_MS = 8 * 60 * 60 * 1000; // 8 horas en milisegundos
      
      const now = new Date();
      const expiryTime = now.getTime() + TOKEN_DURATION_MS;

      // Usar localStorage en lugar de sessionStorage para persistir en móviles
      localStorage.setItem("token", data.token);
      localStorage.setItem("tokenExpiry", expiryTime.toString());
      localStorage.setItem("rol", data.rol);
      localStorage.setItem("cajaId", data.cajaId);
      localStorage.setItem("userName", data.userName);
      localStorage.setItem("usuarioId", data.usuarioId);
      
      // Limpiar sesión automáticamente cuando expire el token
      setTimeout(() => {
        localStorage.removeItem("token");
        localStorage.removeItem("tokenExpiry");
        localStorage.removeItem("rol");
        localStorage.removeItem("cajaId");
        localStorage.removeItem("userName");
        localStorage.removeItem("usuarioId");
        message.info("Tu sesión ha expirado. Iniciá sesión nuevamente.");
        navigate("/login");
      }, TOKEN_DURATION_MS);

      message.success("Inicio de sesión exitoso");

      navigate("/ventas");
      window.location.reload();
    } catch (error) {
      message.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-900">
      <Card title="Iniciar Sesión" className="w-96 shadow-lg">
        <Form onFinish={onFinish} layout="vertical">
          <Form.Item
            label="Usuario"
            name="usuario"
            rules={[{ required: true, message: "Ingrese su usuario" }]}
          >
            <Input placeholder="Usuario" />
          </Form.Item>

          <Form.Item
            label="Contraseña"
            name="password"
            rules={[{ required: true, message: "Ingrese su contraseña" }]}
          >
            <Input.Password placeholder="Contraseña" />
          </Form.Item>

          <Form.Item>
            <Button type="primary" htmlType="submit" block loading={loading}>
              Iniciar Sesión
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
};

export default Login;
