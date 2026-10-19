import type { Metadata } from "next";
export const metadata: Metadata = {
  title: "You Were Here · DevDay DelhiNCR",
  description: "A shared signature tent card for DevDay Community DelhiNCR.",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" href="data:," />
      </head>
      <body>{children}</body>
    </html>
  );
}
