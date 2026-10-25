import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Who's Next?",
  description: "An anonymous public prediction game about which famous person will be next to leave the mortal coil.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
