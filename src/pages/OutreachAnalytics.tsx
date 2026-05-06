import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useEmailAnalytics } from '@/hooks/useEmailAnalytics';
import { Loader2, Mail, MousePointerClick, Eye, MessageSquare, TrendingUp, TrendingDown } from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  Legend,
  BarChart,
  Bar,
} from 'recharts';
import { format, parseISO } from 'date-fns';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useState } from 'react';

const CHART_COLORS = [
  'hsl(var(--primary))',
  'hsl(var(--accent))',
  'hsl(var(--status-qualified))',
  'hsl(var(--status-quoted))',
  'hsl(var(--status-contacted))',
];

export default function OutreachAnalytics() {
  const [timeRange, setTimeRange] = useState<number>(30);
  const { data, isLoading } = useEmailAnalytics(timeRange);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        No analytics data available
      </div>
    );
  }

  const { dailyStats, emailTypeStats, totals } = data;

  // Format dates for chart display
  const chartData = dailyStats.map((stat) => ({
    ...stat,
    dateLabel: format(parseISO(stat.date), 'MMM d'),
  }));

  // Engagement funnel data
  const funnelData = [
    { name: 'Sent', value: totals.sent, fill: 'hsl(var(--primary))' },
    { name: 'Opened', value: totals.opened, fill: 'hsl(var(--status-contacted))' },
    { name: 'Clicked', value: totals.clicked, fill: 'hsl(var(--status-qualified))' },
    { name: 'Replied', value: totals.replied, fill: 'hsl(var(--status-closed))' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold">Email Analytics</h1>
          <p className="text-muted-foreground">Track your email performance over time</p>
        </div>
        <Select value={String(timeRange)} onValueChange={(v) => setTimeRange(Number(v))}>
          <SelectTrigger className="w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7">Last 7 days</SelectItem>
            <SelectItem value="14">Last 14 days</SelectItem>
            <SelectItem value="30">Last 30 days</SelectItem>
            <SelectItem value="60">Last 60 days</SelectItem>
            <SelectItem value="90">Last 90 days</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          title="Total Sent"
          value={totals.sent}
          icon={Mail}
          color="text-primary"
        />
        <StatCard
          title="Open Rate"
          value={`${totals.openRate}%`}
          subtext={`${totals.opened} opened`}
          icon={Eye}
          color="text-status-contacted"
        />
        <StatCard
          title="Click Rate"
          value={`${totals.clickRate}%`}
          subtext={`${totals.clicked} clicked`}
          icon={MousePointerClick}
          color="text-status-qualified"
        />
        <StatCard
          title="Reply Rate"
          value={`${totals.replyRate}%`}
          subtext={`${totals.replied} replied`}
          icon={MessageSquare}
          color="text-status-closed"
        />
      </div>

      {/* Main Charts */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Trends Line Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Email Performance Trends</CardTitle>
            <CardDescription>Daily sends, opens, clicks, and replies</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis
                    dataKey="dateLabel"
                    tick={{ fontSize: 12 }}
                    className="text-muted-foreground"
                    interval="preserveStartEnd"
                  />
                  <YAxis tick={{ fontSize: 12 }} className="text-muted-foreground" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="sent"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    dot={false}
                    name="Sent"
                  />
                  <Line
                    type="monotone"
                    dataKey="opened"
                    stroke="hsl(var(--status-contacted))"
                    strokeWidth={2}
                    dot={false}
                    name="Opened"
                  />
                  <Line
                    type="monotone"
                    dataKey="clicked"
                    stroke="hsl(var(--status-qualified))"
                    strokeWidth={2}
                    dot={false}
                    name="Clicked"
                  />
                  <Line
                    type="monotone"
                    dataKey="replied"
                    stroke="hsl(var(--status-closed))"
                    strokeWidth={2}
                    dot={false}
                    name="Replied"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Engagement Funnel */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Engagement Funnel</CardTitle>
            <CardDescription>Conversion from sent to replied</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={funnelData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 12 }} />
                  <YAxis dataKey="name" type="category" tick={{ fontSize: 12 }} width={60} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                    }}
                  />
                  <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                    {funnelData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Secondary Charts */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Opens vs Sends Area Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Open Rate Over Time</CardTitle>
            <CardDescription>Comparing sends and opens daily</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis
                    dataKey="dateLabel"
                    tick={{ fontSize: 12 }}
                    interval="preserveStartEnd"
                  />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="sent"
                    stackId="1"
                    stroke="hsl(var(--primary))"
                    fill="hsl(var(--primary)/0.3)"
                    name="Sent"
                  />
                  <Area
                    type="monotone"
                    dataKey="opened"
                    stackId="2"
                    stroke="hsl(var(--status-contacted))"
                    fill="hsl(var(--status-contacted)/0.3)"
                    name="Opened"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Email Type Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Emails by Type</CardTitle>
            <CardDescription>Distribution of email categories</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[250px]">
              {emailTypeStats.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={emailTypeStats}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={90}
                      dataKey="count"
                      nameKey="type"
                      label={({ type, count }) => `${type}: ${count}`}
                      labelLine={false}
                    >
                      {emailTypeStats.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                      }}
                    />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  No email type data available
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

interface StatCardProps {
  title: string;
  value: string | number;
  subtext?: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  trend?: 'up' | 'down';
}

function StatCard({ title, value, subtext, icon: Icon, color, trend }: StatCardProps) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">{title}</p>
            <div className="flex items-baseline gap-2">
              <p className="text-2xl font-bold">{value}</p>
              {trend && (
                trend === 'up' 
                  ? <TrendingUp className="w-4 h-4 text-status-closed" />
                  : <TrendingDown className="w-4 h-4 text-destructive" />
              )}
            </div>
            {subtext && <p className="text-xs text-muted-foreground">{subtext}</p>}
          </div>
          <div className={`p-2 rounded-lg bg-muted ${color}`}>
            <Icon className="w-5 h-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
