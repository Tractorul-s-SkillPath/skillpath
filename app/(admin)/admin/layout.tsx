export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <section className="admin-layout-wrapper">
      {/* Future sidebar or navbar for admin can be placed here */}
      {children}
    </section>
  );
}