import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function AppDashboardPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Session 0 scaffold. Domain features ship in subsequent sessions.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Next steps</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>- Session 1: real auth flow (NestJS-issued JWT, proper password hashing)</p>
          <p>- Session 2: Contacts / Deals / Pipelines domain models</p>
          <p>- Session 3: AI Copilot powered by OpenAI + Serper</p>
        </CardContent>
      </Card>
    </div>
  );
}
