
import "./globals.css";
import "../styles/tokens.css";
import "../styles/animations.css";


export const metadata = {
  title: "Chatbot",
  description: "Chatbot",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        {children}
      </body>
    </html>
  );
}

