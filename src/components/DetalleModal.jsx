import React, { useState } from "react";
import "./DetalleModal.css"; 

const DetalleModal = ({ item, onClose }) => {
  if (!item) return null;

  const formatMoney = (amount) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 0
    }).format(amount);
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <div className="modal-header">
          <h3>{item.tipo}: {item.numero}</h3>
          <button className="close-button" onClick={onClose}>×</button>
        </div>
        
        <div className="modal-body">
          <div className="info-row">
            <span className="info-label">Negocio:</span>
            <span className="info-value">{item.negocio.nombre}</span>
          </div>
          
          <div className="info-row">
            <span className="info-label">Monto Total:</span>
            <span className="info-value">{formatMoney(item.monto)}</span>
          </div>
          
          <div className="info-row">
            <span className="info-label">Estado:</span>
            <span className="info-value">
              <span className={`estado-badge ${item.metodo_pago ? 'pagado' : 'pendiente'}`}>
                {item.metodo_pago ? "Pagado" : "Pendiente"}
              </span>
            </span>
          </div>
          
          {item.metodo_pago && (
            <div className="info-row">
              <span className="info-label">Método de pago:</span>
              <span className="info-value capitalize">{item.metodo_pago}</span>
            </div>
          )}
          
          {item.detalles && item.detalles.length > 0 && (
            <div className="detalles-section">
              <h4>Detalles</h4>
              <table className="detalles-table">
                <thead>
                  <tr>
                    <th>Producto</th>
                    <th>Cantidad</th>
                    <th>Precio</th>
                    <th>Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  {item.detalles.map(detalle => (
                    <tr key={detalle.id}>
                      <td>{detalle.producto.nombre}</td>
                      <td>{detalle.cantidad}</td>
                      <td>{formatMoney(detalle.precio)}</td>
                      <td>{formatMoney(detalle.subTotal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        
        <div className="modal-footer">
          <button className="close-button-text" onClick={onClose}>Cerrar</button>
        </div>
      </div>
    </div>
  );
};

export default DetalleModal;