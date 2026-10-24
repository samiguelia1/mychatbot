import type { Metadata } from "next";
import "./globals.css";


export const metadata: Metadata = {
  title: "CloudBox - Modern File Storage",
  description: "A modern file storage and hosting management application",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased">
      
          {children}
  
      </body>
    </html>
  );
}
