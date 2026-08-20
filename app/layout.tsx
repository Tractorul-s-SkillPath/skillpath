/**
 * Root layout.
 *
 * Layer: PAGE — fetch + render only (§3)
 * Story: SP-001
 *
 * Sketch
 *  - <html lang="en">, font, globals.css, <body> + children
 *  - no session read here; each route group decides its own guard
 */

 import "./globals.css";

 export default function RootLayout({
   children,
 }: {
   children: React.ReactNode;
 }) {
   return (
     <html lang="ro">
       <body>{children}</body>
     </html>
   );
 }
