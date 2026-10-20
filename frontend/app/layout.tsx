import "./globals.css";
export const metadata = {
  title: "Zeest | Physician workspace",
  description: "Local synthetic clinical prototype",
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
