// This is the crucial line that loads all styles!
import './globals.css';

export const metadata = {
  title: 'SkillPath',
  description: 'Skill tracking and assessment platform',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased text-gray-900 bg-gray-50">
        {children}
      </body>
    </html>
  );
}