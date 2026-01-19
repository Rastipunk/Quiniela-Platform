// Banner explicativo de notificaciones
// Se muestra dentro de cada tab cuando hay acciones pendientes

type NotificationBannerProps = {
  items: {
    icon: string;
    message: string;
  }[];
};

export function NotificationBanner({ items }: NotificationBannerProps) {
  if (items.length === 0) return null;

  return (
    <div
      style={{
        marginBottom: 16,
        padding: "12px 16px",
        background: "#eff6ff",
        border: "1px solid #bfdbfe",
        borderRadius: 10,
        display: "flex",
        flexDirection: "column",
        gap: 8,
      }}
    >
      {items.map((item, index) => (
        <div
          key={index}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            fontSize: 14,
            color: "#1e40af",
          }}
        >
          <span style={{ fontSize: 16 }}>{item.icon}</span>
          <span>{item.message}</span>
        </div>
      ))}
    </div>
  );
}
