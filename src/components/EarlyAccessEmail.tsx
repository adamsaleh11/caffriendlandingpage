type Props = { email: string; source?: string };

export default function EarlyAccessEmail({ email, source }: Props) {
  return (
    <div style={{ fontFamily: "Arial, sans-serif", lineHeight: 1.5 }}>
      <h2 style={{ margin: "0 0 8px" }}>New Early Access signup</h2>
      <p style={{ margin: "0 0 4px" }}>
        <strong>Email:</strong> {email}
      </p>
      {source ? (
        <p style={{ margin: "0 0 4px" }}>
          <strong>Source:</strong> {source}
        </p>
      ) : null}
      <hr
        style={{
          margin: "12px 0",
          border: "none",
          borderTop: "1px solid #eee",
        }}
      />
      <p style={{ color: "#888", fontSize: 12, margin: 0 }}>
        Sent via Caffriend
      </p>
    </div>
  );
}
