import { SettingsNav } from "@/components/settings-nav";

export default function SettingsLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <>
    <SettingsNav />
    {children}
  </>;
}
