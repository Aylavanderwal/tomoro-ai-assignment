import { useState, Fragment } from 'react';
import {
  LayoutDashboard,
  Clock,
  AlertTriangle,
  Database,
  GitBranch,
  CheckCircle2,
  Shield,
  Box,
  FileText,
  ListChecks,
  Activity,
  Users,
  Settings,
  Search,
  Filter,
  Plus,
  Hexagon,
  ChevronRight,
  ChevronDown,
  User,
  Plane,
  Briefcase,
  Package,
  Network,
  Link2,
  Sparkles,
  ArrowRight,
  Lock,
  RotateCcw,
  ClipboardList,
  FlaskConical,
} from 'lucide-react';

type Dataset = {
  id: string;
  name: string;
  domain: string;
  owner: string;
  status: 'Needs attention' | 'Healthy' | 'Processing' | 'Completed' | 'Warning';
  recordsImpacted: string;
  lastUpdated: string;
  statusColor: string;
  bgColor: string;
};

const statusBadgeClass: Record<Dataset['status'], string> = {
  'Healthy':         'bg-[#d1fae5] text-[#059669]',
  'Needs attention': 'bg-[#fef3c7] text-[#d97706]',
  'Warning':         'bg-[#fef3c7] text-[#d97706]',
  'Processing':      'bg-[#eff6ff] text-[#2563eb]',
  'Completed':       'bg-[#f3f4f6] text-[#6b7280]',
};

export default function App() {
  const [selectedTab, setSelectedTab] = useState<string>('passengers');
  const [expandedDataset, setExpandedDataset] = useState<string | null>('passenger-master');

  const datasetsByCategory: Record<string, Dataset[]> = {
    passengers: [
      {
        id: 'passenger-master',
        name: 'Passenger Master',
        domain: 'Customer',
        owner: 'Data Operations',
        status: 'Needs attention',
        recordsImpacted: '1.2M',
        lastUpdated: '2 min ago',
        statusColor: 'text-[#d97706]',
        bgColor: 'bg-[#fef3c7]',
      },
      {
        id: 'loyalty-profiles',
        name: 'Loyalty Profiles',
        domain: 'Customer',
        owner: 'Revenue Management',
        status: 'Healthy',
        recordsImpacted: '840K',
        lastUpdated: '15 min ago',
        statusColor: 'text-[#059669]',
        bgColor: 'bg-[#d1fae5]',
      },
      {
        id: 'booking-contacts',
        name: 'Booking Contacts',
        domain: 'Customer',
        owner: 'Commercial',
        status: 'Healthy',
        recordsImpacted: '2.1M',
        lastUpdated: '1 hr ago',
        statusColor: 'text-[#059669]',
        bgColor: 'bg-[#d1fae5]',
      },
      {
        id: 'passenger-preferences',
        name: 'Passenger Preferences',
        domain: 'Customer',
        owner: 'Customer Experience',
        status: 'Healthy',
        recordsImpacted: '980K',
        lastUpdated: '45 min ago',
        statusColor: 'text-[#059669]',
        bgColor: 'bg-[#d1fae5]',
      },
      {
        id: 'frequent-flyer',
        name: 'Frequent Flyer Tier Status',
        domain: 'Customer',
        owner: 'Loyalty',
        status: 'Processing',
        recordsImpacted: '340K',
        lastUpdated: '12 min ago',
        statusColor: 'text-[#2563eb]',
        bgColor: 'bg-[#dbeafe]',
      },
      {
        id: 'passenger-segments',
        name: 'Passenger Segments',
        domain: 'Customer',
        owner: 'Marketing',
        status: 'Healthy',
        recordsImpacted: '1.5M',
        lastUpdated: '2 hr ago',
        statusColor: 'text-[#059669]',
        bgColor: 'bg-[#d1fae5]',
      },
      {
        id: 'customer-feedback',
        name: 'Customer Feedback',
        domain: 'Customer',
        owner: 'Customer Experience',
        status: 'Completed',
        recordsImpacted: '45K',
        lastUpdated: '6 hr ago',
        statusColor: 'text-[#6b7280]',
        bgColor: 'bg-[#f3f4f6]',
      },
      {
        id: 'travel-history',
        name: 'Travel History',
        domain: 'Customer',
        owner: 'Data Operations',
        status: 'Healthy',
        recordsImpacted: '8.4M',
        lastUpdated: '30 min ago',
        statusColor: 'text-[#059669]',
        bgColor: 'bg-[#d1fae5]',
      },
      {
        id: 'special-service-requests',
        name: 'Special Service Requests',
        domain: 'Customer',
        owner: 'Airport Operations',
        status: 'Healthy',
        recordsImpacted: '125K',
        lastUpdated: '1 hr ago',
        statusColor: 'text-[#059669]',
        bgColor: 'bg-[#d1fae5]',
      },
      {
        id: 'passenger-complaints',
        name: 'Passenger Complaints',
        domain: 'Customer',
        owner: 'Customer Relations',
        status: 'Processing',
        recordsImpacted: '18K',
        lastUpdated: '25 min ago',
        statusColor: 'text-[#2563eb]',
        bgColor: 'bg-[#dbeafe]',
      },
      {
        id: 'identity-verification',
        name: 'Identity Verification Records',
        domain: 'Customer',
        owner: 'Security',
        status: 'Healthy',
        recordsImpacted: '1.8M',
        lastUpdated: '3 hr ago',
        statusColor: 'text-[#059669]',
        bgColor: 'bg-[#d1fae5]',
      },
      {
        id: 'minor-passengers',
        name: 'Unaccompanied Minor Records',
        domain: 'Customer',
        owner: 'Airport Operations',
        status: 'Healthy',
        recordsImpacted: '12K',
        lastUpdated: '4 hr ago',
        statusColor: 'text-[#059669]',
        bgColor: 'bg-[#d1fae5]',
      },
    ],
    flight: [
      {
        id: 'flight-disruption',
        name: 'Flight Disruption Events',
        domain: 'Operations',
        owner: 'Network Planning',
        status: 'Processing',
        recordsImpacted: '3.2K',
        lastUpdated: '5 min ago',
        statusColor: 'text-[#2563eb]',
        bgColor: 'bg-[#dbeafe]',
      },
      {
        id: 'delay-tracking',
        name: 'Delay Tracking',
        domain: 'Operations',
        owner: 'Operations Control',
        status: 'Healthy',
        recordsImpacted: '42K',
        lastUpdated: '8 min ago',
        statusColor: 'text-[#059669]',
        bgColor: 'bg-[#d1fae5]',
      },
      {
        id: 'cancellation-log',
        name: 'Cancellation Log',
        domain: 'Operations',
        owner: 'Operations Control',
        status: 'Healthy',
        recordsImpacted: '1.8K',
        lastUpdated: '20 min ago',
        statusColor: 'text-[#059669]',
        bgColor: 'bg-[#d1fae5]',
      },
      {
        id: 'crew-assignments',
        name: 'Crew Assignments',
        domain: 'Operations',
        owner: 'Crew Planning',
        status: 'Processing',
        recordsImpacted: '15K',
        lastUpdated: '10 min ago',
        statusColor: 'text-[#2563eb]',
        bgColor: 'bg-[#dbeafe]',
      },
      {
        id: 'aircraft-rotations',
        name: 'Aircraft Rotations',
        domain: 'Operations',
        owner: 'Fleet Management',
        status: 'Healthy',
        recordsImpacted: '8.5K',
        lastUpdated: '15 min ago',
        statusColor: 'text-[#059669]',
        bgColor: 'bg-[#d1fae5]',
      },
      {
        id: 'gate-assignments',
        name: 'Gate Assignments',
        domain: 'Operations',
        owner: 'Airport Operations',
        status: 'Healthy',
        recordsImpacted: '22K',
        lastUpdated: '5 min ago',
        statusColor: 'text-[#059669]',
        bgColor: 'bg-[#d1fae5]',
      },
      {
        id: 'weather-impact',
        name: 'Weather Impact Analysis',
        domain: 'Operations',
        owner: 'Network Planning',
        status: 'Processing',
        recordsImpacted: '4.1K',
        lastUpdated: '18 min ago',
        statusColor: 'text-[#2563eb]',
        bgColor: 'bg-[#dbeafe]',
      },
      {
        id: 'maintenance-delays',
        name: 'Maintenance Delays',
        domain: 'Operations',
        owner: 'Technical Operations',
        status: 'Warning',
        recordsImpacted: '890',
        lastUpdated: '35 min ago',
        statusColor: 'text-[#d97706]',
        bgColor: 'bg-[#fef3c7]',
      },
      {
        id: 'slot-coordination',
        name: 'Slot Coordination',
        domain: 'Operations',
        owner: 'Network Planning',
        status: 'Healthy',
        recordsImpacted: '18K',
        lastUpdated: '1 hr ago',
        statusColor: 'text-[#059669]',
        bgColor: 'bg-[#d1fae5]',
      },
      {
        id: 'fuel-consumption',
        name: 'Fuel Consumption Data',
        domain: 'Operations',
        owner: 'Flight Operations',
        status: 'Healthy',
        recordsImpacted: '65K',
        lastUpdated: '40 min ago',
        statusColor: 'text-[#059669]',
        bgColor: 'bg-[#d1fae5]',
      },
      {
        id: 'turnaround-times',
        name: 'Aircraft Turnaround Times',
        domain: 'Operations',
        owner: 'Ground Operations',
        status: 'Completed',
        recordsImpacted: '28K',
        lastUpdated: '5 hr ago',
        statusColor: 'text-[#6b7280]',
        bgColor: 'bg-[#f3f4f6]',
      },
    ],
    baggage: [
      {
        id: 'baggage-tracking',
        name: 'Baggage Tracking',
        domain: 'Operations',
        owner: 'Ground Services',
        status: 'Completed',
        recordsImpacted: '120K',
        lastUpdated: '3 hr ago',
        statusColor: 'text-[#6b7280]',
        bgColor: 'bg-[#f3f4f6]',
      },
      {
        id: 'mishandled-baggage',
        name: 'Mishandled Baggage',
        domain: 'Operations',
        owner: 'Baggage Services',
        status: 'Processing',
        recordsImpacted: '2.4K',
        lastUpdated: '22 min ago',
        statusColor: 'text-[#2563eb]',
        bgColor: 'bg-[#dbeafe]',
      },
      {
        id: 'baggage-reconciliation',
        name: 'Baggage Reconciliation',
        domain: 'Operations',
        owner: 'Ground Services',
        status: 'Healthy',
        recordsImpacted: '118K',
        lastUpdated: '50 min ago',
        statusColor: 'text-[#059669]',
        bgColor: 'bg-[#d1fae5]',
      },
      {
        id: 'cargo-manifests',
        name: 'Cargo Manifests',
        domain: 'Cargo',
        owner: 'Cargo Operations',
        status: 'Healthy',
        recordsImpacted: '34K',
        lastUpdated: '1 hr ago',
        statusColor: 'text-[#059669]',
        bgColor: 'bg-[#d1fae5]',
      },
      {
        id: 'oversized-baggage',
        name: 'Oversized Baggage',
        domain: 'Operations',
        owner: 'Ground Services',
        status: 'Healthy',
        recordsImpacted: '8.2K',
        lastUpdated: '2 hr ago',
        statusColor: 'text-[#059669]',
        bgColor: 'bg-[#d1fae5]',
      },
      {
        id: 'baggage-claims',
        name: 'Baggage Claims',
        domain: 'Customer',
        owner: 'Customer Relations',
        status: 'Processing',
        recordsImpacted: '1.5K',
        lastUpdated: '30 min ago',
        statusColor: 'text-[#2563eb]',
        bgColor: 'bg-[#dbeafe]',
      },
      {
        id: 'cargo-tracking',
        name: 'Cargo Tracking',
        domain: 'Cargo',
        owner: 'Cargo Operations',
        status: 'Healthy',
        recordsImpacted: '45K',
        lastUpdated: '45 min ago',
        statusColor: 'text-[#059669]',
        bgColor: 'bg-[#d1fae5]',
      },
      {
        id: 'dangerous-goods',
        name: 'Dangerous Goods Records',
        domain: 'Cargo',
        owner: 'Safety & Compliance',
        status: 'Healthy',
        recordsImpacted: '3.8K',
        lastUpdated: '3 hr ago',
        statusColor: 'text-[#059669]',
        bgColor: 'bg-[#d1fae5]',
      },
      {
        id: 'baggage-weights',
        name: 'Baggage Weight Distribution',
        domain: 'Operations',
        owner: 'Load Control',
        status: 'Completed',
        recordsImpacted: '95K',
        lastUpdated: '6 hr ago',
        statusColor: 'text-[#6b7280]',
        bgColor: 'bg-[#f3f4f6]',
      },
    ],
    commercial: [
      {
        id: 'revenue-bookings',
        name: 'Revenue Bookings',
        domain: 'Commercial',
        owner: 'Revenue Management',
        status: 'Healthy',
        recordsImpacted: '3.2M',
        lastUpdated: '25 min ago',
        statusColor: 'text-[#059669]',
        bgColor: 'bg-[#d1fae5]',
      },
      {
        id: 'pricing-rules',
        name: 'Pricing Rules',
        domain: 'Commercial',
        owner: 'Revenue Management',
        status: 'Processing',
        recordsImpacted: '12K',
        lastUpdated: '15 min ago',
        statusColor: 'text-[#2563eb]',
        bgColor: 'bg-[#dbeafe]',
      },
      {
        id: 'fare-classes',
        name: 'Fare Classes',
        domain: 'Commercial',
        owner: 'Revenue Management',
        status: 'Healthy',
        recordsImpacted: '840',
        lastUpdated: '2 hr ago',
        statusColor: 'text-[#059669]',
        bgColor: 'bg-[#d1fae5]',
      },
      {
        id: 'ancillary-revenue',
        name: 'Ancillary Revenue',
        domain: 'Commercial',
        owner: 'Commercial',
        status: 'Healthy',
        recordsImpacted: '1.8M',
        lastUpdated: '1 hr ago',
        statusColor: 'text-[#059669]',
        bgColor: 'bg-[#d1fae5]',
      },
      {
        id: 'seat-inventory',
        name: 'Seat Inventory',
        domain: 'Commercial',
        owner: 'Revenue Management',
        status: 'Healthy',
        recordsImpacted: '28K',
        lastUpdated: '20 min ago',
        statusColor: 'text-[#059669]',
        bgColor: 'bg-[#d1fae5]',
      },
      {
        id: 'group-bookings',
        name: 'Group Bookings',
        domain: 'Commercial',
        owner: 'Sales',
        status: 'Processing',
        recordsImpacted: '4.5K',
        lastUpdated: '40 min ago',
        statusColor: 'text-[#2563eb]',
        bgColor: 'bg-[#dbeafe]',
      },
      {
        id: 'corporate-contracts',
        name: 'Corporate Contracts',
        domain: 'Commercial',
        owner: 'Sales',
        status: 'Healthy',
        recordsImpacted: '2.1K',
        lastUpdated: '3 hr ago',
        statusColor: 'text-[#059669]',
        bgColor: 'bg-[#d1fae5]',
      },
      {
        id: 'upgrade-tracking',
        name: 'Upgrade Tracking',
        domain: 'Commercial',
        owner: 'Revenue Management',
        status: 'Healthy',
        recordsImpacted: '38K',
        lastUpdated: '55 min ago',
        statusColor: 'text-[#059669]',
        bgColor: 'bg-[#d1fae5]',
      },
      {
        id: 'promo-codes',
        name: 'Promotional Codes',
        domain: 'Commercial',
        owner: 'Marketing',
        status: 'Completed',
        recordsImpacted: '15K',
        lastUpdated: '4 hr ago',
        statusColor: 'text-[#6b7280]',
        bgColor: 'bg-[#f3f4f6]',
      },
      {
        id: 'channel-distribution',
        name: 'Channel Distribution',
        domain: 'Commercial',
        owner: 'Distribution',
        status: 'Healthy',
        recordsImpacted: '2.8M',
        lastUpdated: '1 hr ago',
        statusColor: 'text-[#059669]',
        bgColor: 'bg-[#d1fae5]',
      },
    ],
    network: [
      {
        id: 'route-performance',
        name: 'Route Performance',
        domain: 'Network',
        owner: 'Network Planning',
        status: 'Healthy',
        recordsImpacted: '840',
        lastUpdated: '1 hr ago',
        statusColor: 'text-[#059669]',
        bgColor: 'bg-[#d1fae5]',
      },
      {
        id: 'schedule-adherence',
        name: 'Schedule Adherence',
        domain: 'Operations',
        owner: 'Network Planning',
        status: 'Processing',
        recordsImpacted: '22K',
        lastUpdated: '12 min ago',
        statusColor: 'text-[#2563eb]',
        bgColor: 'bg-[#dbeafe]',
      },
      {
        id: 'capacity-planning',
        name: 'Capacity Planning',
        domain: 'Network',
        owner: 'Network Planning',
        status: 'Healthy',
        recordsImpacted: '680',
        lastUpdated: '2 hr ago',
        statusColor: 'text-[#059669]',
        bgColor: 'bg-[#d1fae5]',
      },
      {
        id: 'seasonal-demand',
        name: 'Seasonal Demand Forecasts',
        domain: 'Network',
        owner: 'Revenue Management',
        status: 'Healthy',
        recordsImpacted: '1.2K',
        lastUpdated: '5 hr ago',
        statusColor: 'text-[#059669]',
        bgColor: 'bg-[#d1fae5]',
      },
      {
        id: 'competitor-analysis',
        name: 'Competitor Analysis',
        domain: 'Network',
        owner: 'Strategy',
        status: 'Completed',
        recordsImpacted: '450',
        lastUpdated: '1 day ago',
        statusColor: 'text-[#6b7280]',
        bgColor: 'bg-[#f3f4f6]',
      },
      {
        id: 'airport-connectivity',
        name: 'Airport Connectivity',
        domain: 'Network',
        owner: 'Network Planning',
        status: 'Healthy',
        recordsImpacted: '340',
        lastUpdated: '3 hr ago',
        statusColor: 'text-[#059669]',
        bgColor: 'bg-[#d1fae5]',
      },
      {
        id: 'fleet-utilization',
        name: 'Fleet Utilization',
        domain: 'Network',
        owner: 'Fleet Management',
        status: 'Healthy',
        recordsImpacted: '185',
        lastUpdated: '45 min ago',
        statusColor: 'text-[#059669]',
        bgColor: 'bg-[#d1fae5]',
      },
      {
        id: 'codeshare-performance',
        name: 'Codeshare Performance',
        domain: 'Network',
        owner: 'Alliances',
        status: 'Processing',
        recordsImpacted: '2.4K',
        lastUpdated: '30 min ago',
        statusColor: 'text-[#2563eb]',
        bgColor: 'bg-[#dbeafe]',
      },
    ],
    partner: [
      {
        id: 'partner-sync',
        name: 'Partner Airline Sync',
        domain: 'Commercial',
        owner: 'Alliances',
        status: 'Healthy',
        recordsImpacted: '45K',
        lastUpdated: '30 min ago',
        statusColor: 'text-[#059669]',
        bgColor: 'bg-[#d1fae5]',
      },
      {
        id: 'interline-bookings',
        name: 'Interline Bookings',
        domain: 'Commercial',
        owner: 'Alliances',
        status: 'Healthy',
        recordsImpacted: '28K',
        lastUpdated: '1 hr ago',
        statusColor: 'text-[#059669]',
        bgColor: 'bg-[#d1fae5]',
      },
      {
        id: 'alliance-benefits',
        name: 'Alliance Benefits Tracking',
        domain: 'Customer',
        owner: 'Loyalty',
        status: 'Processing',
        recordsImpacted: '120K',
        lastUpdated: '25 min ago',
        statusColor: 'text-[#2563eb]',
        bgColor: 'bg-[#dbeafe]',
      },
      {
        id: 'vendor-contracts',
        name: 'Vendor Contracts',
        domain: 'Procurement',
        owner: 'Supply Chain',
        status: 'Healthy',
        recordsImpacted: '3.8K',
        lastUpdated: '4 hr ago',
        statusColor: 'text-[#059669]',
        bgColor: 'bg-[#d1fae5]',
      },
      {
        id: 'gds-bookings',
        name: 'GDS Bookings',
        domain: 'Commercial',
        owner: 'Distribution',
        status: 'Healthy',
        recordsImpacted: '1.9M',
        lastUpdated: '35 min ago',
        statusColor: 'text-[#059669]',
        bgColor: 'bg-[#d1fae5]',
      },
      {
        id: 'third-party-apis',
        name: 'Third-Party API Integrations',
        domain: 'Technology',
        owner: 'IT Operations',
        status: 'Warning',
        recordsImpacted: '68',
        lastUpdated: '50 min ago',
        statusColor: 'text-[#d97706]',
        bgColor: 'bg-[#fef3c7]',
      },
      {
        id: 'partner-sla',
        name: 'Partner SLA Metrics',
        domain: 'Operations',
        owner: 'Alliances',
        status: 'Completed',
        recordsImpacted: '240',
        lastUpdated: '8 hr ago',
        statusColor: 'text-[#6b7280]',
        bgColor: 'bg-[#f3f4f6]',
      },
    ],
  };

  const tabs = [
    { id: 'passengers', label: 'Passengers', icon: User, color: '#3b82f6' },
    { id: 'flight', label: 'Flight Disruptions', icon: Plane, color: '#8b5cf6' },
    { id: 'baggage', label: 'Baggage & Cargo', icon: Package, color: '#06b6d4' },
    { id: 'commercial', label: 'Commercial', icon: Briefcase, color: '#10b981' },
    { id: 'network', label: 'Network & Planning', icon: Network, color: '#f59e0b' },
    { id: 'partner', label: 'Partner Data', icon: Link2, color: '#ec4899' },
  ];

  const currentDatasets = datasetsByCategory[selectedTab] || [];

  return (
    <div className="h-screen flex bg-background">
      {/* Left Sidebar */}
      <div className="w-56 bg-[#f9fafb] border-r border-border flex flex-col">
        <div className="px-4 py-5 border-b border-border">
          <div className="flex items-center gap-2">
            <Hexagon className="size-5 text-[#3b82f6]" strokeWidth={2} fill="#3b82f6" fillOpacity={0.1} />
            <div className="text-[14px] font-medium text-foreground">AeroData</div>
          </div>
        </div>
        <nav className="flex-1 px-3 py-4 overflow-y-auto">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2 px-3 py-2 text-[13px] text-foreground hover:bg-accent rounded-md cursor-pointer">
              <LayoutDashboard className="size-4 text-[#3b82f6]" strokeWidth={2} />
              <span>Overview</span>
            </div>
            <div className="flex items-center gap-2 px-3 py-2 text-[13px] text-foreground hover:bg-accent rounded-md cursor-pointer">
              <Box className="size-4 text-[#8b5cf6]" strokeWidth={2} />
              <span>Dashboards</span>
            </div>
            <div className="flex items-center gap-2 px-3 py-2 text-[13px] text-foreground hover:bg-accent rounded-md cursor-pointer">
              <Clock className="size-4 text-[#06b6d4]" strokeWidth={2} />
              <span>Recents</span>
            </div>
            <div className="flex items-center gap-2 px-3 py-2 text-[13px] text-foreground hover:bg-accent rounded-md cursor-pointer">
              <AlertTriangle className="size-4 text-[#f59e0b]" strokeWidth={2} />
              <span>Alerts</span>
            </div>
            <div className="flex items-center gap-2 px-3 py-2 text-[13px] text-foreground bg-accent rounded-md cursor-pointer font-medium">
              <Database className="size-4 text-[#10b981]" strokeWidth={2} />
              <span>Data Assets</span>
            </div>
            <div className="flex items-center gap-2 px-3 py-2 text-[13px] text-foreground hover:bg-accent rounded-md cursor-pointer">
              <GitBranch className="size-4 text-[#ec4899]" strokeWidth={2} />
              <span>Pipelines</span>
            </div>
            <div className="flex items-center gap-2 px-3 py-2 text-[13px] text-foreground hover:bg-accent rounded-md cursor-pointer">
              <CheckCircle2 className="size-4 text-[#14b8a6]" strokeWidth={2} />
              <span>Quality Checks</span>
            </div>
            <div className="flex items-center gap-2 px-3 py-2 text-[13px] text-foreground hover:bg-accent rounded-md cursor-pointer">
              <Shield className="size-4 text-[#6366f1]" strokeWidth={2} />
              <span>Stewardship</span>
            </div>
            <div className="flex items-center gap-2 px-3 py-2 text-[13px] text-foreground hover:bg-accent rounded-md cursor-pointer">
              <Box className="size-4 text-[#a855f7]" strokeWidth={2} />
              <span>Models</span>
            </div>
            <div className="flex items-center gap-2 px-3 py-2 text-[13px] text-foreground hover:bg-accent rounded-md cursor-pointer">
              <FileText className="size-4 text-[#f97316]" strokeWidth={2} />
              <span>Rules</span>
            </div>
            <div className="flex items-center gap-2 px-3 py-2 text-[13px] text-foreground hover:bg-accent rounded-md cursor-pointer">
              <ListChecks className="size-4 text-[#0ea5e9]" strokeWidth={2} />
              <span>Review Queue</span>
            </div>
            <div className="flex items-center gap-2 px-3 py-2 text-[13px] text-foreground hover:bg-accent rounded-md cursor-pointer">
              <Activity className="size-4 text-[#22c55e]" strokeWidth={2} />
              <span>Activity Log</span>
            </div>
          </div>
          <div className="mt-6 mb-2 px-3 text-[10px] uppercase tracking-widest text-[#6b7280] font-mono">
            Admin
          </div>
          <div className="space-y-0.5">
            <div className="flex items-center gap-2 px-3 py-2 text-[13px] text-foreground hover:bg-accent rounded-md cursor-pointer">
              <Users className="size-4 text-[#6b7280]" strokeWidth={2} />
              <span>Users & Roles</span>
            </div>
            <div className="flex items-center gap-2 px-3 py-2 text-[13px] text-foreground hover:bg-accent rounded-md cursor-pointer">
              <Settings className="size-4 text-[#6b7280]" strokeWidth={2} />
              <span>Settings</span>
            </div>
          </div>
        </nav>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Header */}
        <div className="bg-background border-b border-border px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4 flex-1">
            <h1 className="text-[15px] font-medium text-foreground">
              Passenger Data Operations
            </h1>
            <div className="flex-1 max-w-md relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-[#3b82f6]" strokeWidth={2} />
              <input
                type="text"
                placeholder="Search datasets, pipelines, rules..."
                className="w-full pl-9 pr-3 py-1.5 text-[13px] bg-[#f3f4f6] border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-ring/20 placeholder:text-[#9ca3af] text-foreground"
              />
            </div>
            <button className="flex items-center gap-2 px-3 py-1.5 text-[13px] text-[#374151] border border-border rounded-md hover:bg-[#f3f4f6] transition-colors">
              <Filter className="size-4 text-[#6b7280]" strokeWidth={2} />
              <span>Filters</span>
            </button>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-[12px] text-[#6b7280] font-mono">
              Last sync: 2 min ago
            </span>
            <button className="flex items-center gap-2 px-3 py-1.5 text-[13px] bg-[#2563eb] hover:bg-[#1d4ed8] text-white rounded-md transition-colors">
              <Plus className="size-4" strokeWidth={2} />
              <span>Create rule</span>
            </button>
            <div className="size-8 rounded-full bg-[#e5e7eb] flex items-center justify-center text-[12px] font-semibold text-[#374151]">
              OL
            </div>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-6">
            {/* KPI Row */}
            <div className="grid grid-cols-4 gap-4 mb-6">
              <div className="bg-white border border-border rounded-lg px-4 py-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-[10px] text-[#6b7280] uppercase tracking-widest font-mono">
                    Active Assets
                  </div>
                  <Database className="size-4 text-[#10b981]" strokeWidth={2} />
                </div>
                <div className="text-[22px] font-semibold text-foreground font-mono tracking-tight">142</div>
              </div>
              <div className="bg-white border border-border rounded-lg px-4 py-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-[10px] text-[#6b7280] uppercase tracking-widest font-mono">
                    Open Alerts
                  </div>
                  <AlertTriangle className="size-4 text-[#d97706]" strokeWidth={2} />
                </div>
                <div className="text-[22px] font-semibold text-[#d97706] font-mono tracking-tight">3</div>
              </div>
              <div className="bg-white border border-border rounded-lg px-4 py-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-[10px] text-[#6b7280] uppercase tracking-widest font-mono">
                    Jobs Running
                  </div>
                  <Activity className="size-4 text-[#3b82f6]" strokeWidth={2} />
                </div>
                <div className="text-[22px] font-semibold text-foreground font-mono tracking-tight">8</div>
              </div>
              <div className="bg-white border border-border rounded-lg px-4 py-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-[10px] text-[#6b7280] uppercase tracking-widest font-mono">
                    Awaiting Review
                  </div>
                  <ListChecks className="size-4 text-[#8b5cf6]" strokeWidth={2} />
                </div>
                <div className="text-[22px] font-semibold text-foreground font-mono tracking-tight">12</div>
              </div>
            </div>

            {/* Tabs */}
            <div className="mb-6 border-b border-border">
              <div className="flex gap-6">
                {tabs.map((tab) => {
                  const Icon = tab.icon;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => {
                        setSelectedTab(tab.id);
                        setExpandedDataset(null);
                      }}
                      className={`flex items-center gap-2 px-1 py-3 text-[13px] font-medium border-b-2 transition-colors ${
                        selectedTab === tab.id
                          ? 'text-foreground'
                          : 'border-transparent text-muted-foreground hover:text-foreground'
                      }`}
                      style={selectedTab === tab.id ? { borderBottomColor: tab.color } : {}}
                    >
                      <Icon
                        className="size-4"
                        strokeWidth={2}
                        style={{ color: selectedTab === tab.id ? tab.color : undefined }}
                      />
                      <span>{tab.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Main Table */}
            <div className="bg-white border border-border rounded-lg overflow-hidden">
              <div className="px-5 py-3 border-b border-border flex items-center justify-between">
                <h2 className="text-[13px] font-medium text-foreground">
                  {tabs.find((t) => t.id === selectedTab)?.label} Assets
                </h2>
                <div className="text-[12px] text-[#6b7280] font-mono">
                  {currentDatasets.length} assets
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border bg-[#fafafa]">
                      <th className="w-8 px-3"></th>
                      <th className="px-5 py-2.5 text-left text-[10px] font-medium text-[#6b7280] uppercase tracking-widest font-mono">
                        Dataset
                      </th>
                      <th className="px-5 py-2.5 text-left text-[10px] font-medium text-[#6b7280] uppercase tracking-widest font-mono">
                        Domain
                      </th>
                      <th className="px-5 py-2.5 text-left text-[10px] font-medium text-[#6b7280] uppercase tracking-widest font-mono">
                        Owner
                      </th>
                      <th className="px-5 py-2.5 text-left text-[10px] font-medium text-[#6b7280] uppercase tracking-widest font-mono">
                        Status
                      </th>
                      <th className="px-5 py-2.5 text-left text-[10px] font-medium text-[#6b7280] uppercase tracking-widest font-mono">
                        Records
                      </th>
                      <th className="px-5 py-2.5 text-left text-[10px] font-medium text-[#6b7280] uppercase tracking-widest font-mono">
                        Last Updated
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {currentDatasets.map((dataset) => (
                      <Fragment key={dataset.id}>
                        <tr
                          onClick={() =>
                            setExpandedDataset(
                              expandedDataset === dataset.id ? null : dataset.id
                            )
                          }
                          className={`border-b border-border cursor-pointer transition-colors hover:bg-[#f5f5f5] ${
                            expandedDataset === dataset.id ? 'bg-[#f3f4f6]' : ''
                          }`}
                        >
                          <td className="px-3 py-3">
                            {expandedDataset === dataset.id ? (
                              <ChevronDown className="size-4 text-muted-foreground" strokeWidth={2} />
                            ) : (
                              <ChevronRight className="size-4 text-muted-foreground" strokeWidth={2} />
                            )}
                          </td>
                          <td className="px-5 py-3 text-[13px] font-medium text-foreground">
                            {dataset.name}
                          </td>
                          <td className="px-5 py-3 text-[13px] text-foreground">
                            {dataset.domain}
                          </td>
                          <td className="px-5 py-3 text-[13px] text-muted-foreground">
                            {dataset.owner}
                          </td>
                          <td className="px-5 py-3">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium tracking-wide font-mono ${statusBadgeClass[dataset.status]}`}>
                              {dataset.status}
                            </span>
                          </td>
                          <td className="px-5 py-3 text-[13px] text-[#111827] font-mono tabular-nums">
                            {dataset.recordsImpacted}
                          </td>
                          <td className="px-5 py-3 text-[12px] text-[#6b7280] font-mono">
                            {dataset.lastUpdated}
                          </td>
                        </tr>
                        {expandedDataset === dataset.id && dataset.id === 'passenger-master' && (
                          <tr className="border-b border-border bg-[#fafafa]">
                            <td colSpan={7} className="px-6 pt-5 pb-6">

                              {/* ── AI Intent Banner ── */}
                              <div className="flex items-center justify-between gap-6 bg-[#eff6ff] border border-[#bfdbfe] rounded-lg px-4 py-3 mb-5">
                                <div className="flex items-center gap-3">
                                  <div className="size-8 rounded-md bg-[#2563eb]/10 border border-[#2563eb]/20 flex items-center justify-center shrink-0">
                                    <Sparkles className="size-4 text-[#2563eb]" strokeWidth={1.5} />
                                  </div>
                                  <div>
                                    <div className="text-[13px] font-semibold text-[#111827]">Agent analysis complete — remediation plan ready</div>
                                    <div className="text-[12px] text-[#6b7280] mt-0.5">
                                      1,201,777 records scanned · 703,777 affected across 6 issue types · plan covers all cases
                                    </div>
                                  </div>
                                </div>
                                <div className="flex items-center gap-5 shrink-0 text-[12px] text-[#6b7280]">
                                  <div className="text-right">
                                    <div className="text-[10px] uppercase tracking-widest font-mono mb-0.5">Est. runtime</div>
                                    <div className="text-[#111827] font-mono font-semibold">~2h 40m</div>
                                  </div>
                                  <div className="w-px h-8 bg-border" />
                                  <div className="text-right">
                                    <div className="text-[10px] uppercase tracking-widest font-mono mb-0.5">Analysed</div>
                                    <div className="text-[#111827] font-mono font-semibold">2 min ago</div>
                                  </div>
                                </div>
                              </div>

                              {/* ── Execution Sequence ── */}
                              <div className="mb-5">
                                <div className="text-[10px] text-[#6b7280] uppercase tracking-widest font-mono mb-2.5">Planned execution sequence</div>
                                <div className="flex items-center">
                                  {[
                                    { n: '1', label: 'Classify & assess severity' },
                                    { n: '2', label: 'Auto-resolve safe cases' },
                                    { n: '3', label: 'Route ambiguous to review' },
                                    { n: '4', label: 'Await approval on high-risk' },
                                    { n: '5', label: 'Audit log & summary' },
                                  ].map((step, i) => (
                                    <div key={i} className="flex items-center">
                                      <div className="flex items-center gap-2 bg-white border border-border rounded-md px-3 py-1.5">
                                        <span className="text-[11px] font-mono font-semibold text-[#2563eb]">{step.n}</span>
                                        <span className="text-[12px] text-[#111827] whitespace-nowrap">{step.label}</span>
                                      </div>
                                      {i < 4 && <div className="w-5 h-px bg-border shrink-0" />}
                                    </div>
                                  ))}
                                </div>
                              </div>

                              {/* ── Column headers ── */}
                              <div className="grid gap-3 mb-1.5 px-4" style={{ gridTemplateColumns: '1fr 90px 1fr 90px 120px' }}>
                                {['Issue type', 'Records', 'Agent\'s proposed action', 'Confidence', 'Approval'].map((h) => (
                                  <div key={h} className="text-[10px] text-[#6b7280] uppercase tracking-widest font-mono">{h}</div>
                                ))}
                              </div>

                              {/* ── Issue Buckets ── */}
                              <div className="space-y-2.5 mb-5">

                                {/* Bucket: Auto-resolve */}
                                <div className="rounded-lg overflow-hidden border border-border">
                                  <div className="flex items-center justify-between px-4 py-2 bg-[#d1fae5] border-b border-border">
                                    <div className="flex items-center gap-2">
                                      <div className="w-1.5 h-1.5 rounded-full bg-[#059669] shrink-0" />
                                      <span className="text-[11px] font-semibold text-[#059669] uppercase tracking-widest font-mono">Auto-resolve</span>
                                      <span className="text-[12px] text-[#6b7280] font-mono">· 160,452 records</span>
                                    </div>
                                    <span className="text-[11px] text-[#059669]">High confidence · Low risk · No approval needed</span>
                                  </div>
                                  {[
                                    {
                                      name: 'Loyalty tier conflicts',
                                      count: '89,112',
                                      consequence: 'Incorrect upgrade eligibility and lounge access decisions',
                                      action: 'Sync tier status from loyalty platform',
                                      confidence: 'High',
                                      confidenceStyle: 'bg-[#d1fae5] text-[#059669]',
                                      approval: 'Not required',
                                      approvalStyle: 'text-[#059669]',
                                    },
                                    {
                                      name: 'Implausible dates of birth',
                                      count: '71,340',
                                      consequence: 'Fails age verification at boarding and advance passenger info submission',
                                      action: 'Standardise to ISO-8601; flag ages outside 0–120 in audit log',
                                      confidence: 'High',
                                      confidenceStyle: 'bg-[#d1fae5] text-[#059669]',
                                      approval: 'Not required',
                                      approvalStyle: 'text-[#059669]',
                                    },
                                  ].map((issue, i, arr) => (
                                    <div key={i} className={`grid gap-3 px-4 py-3 bg-white items-start ${i < arr.length - 1 ? 'border-b border-border' : ''}`} style={{ gridTemplateColumns: '1fr 90px 1fr 90px 120px' }}>
                                      <div>
                                        <div className="text-[13px] font-medium text-[#111827]">{issue.name}</div>
                                        <div className="text-[11px] text-[#6b7280] mt-0.5 leading-relaxed">{issue.consequence}</div>
                                      </div>
                                      <div className="text-[13px] font-semibold font-mono text-[#111827] tabular-nums pt-0.5">{issue.count}</div>
                                      <div className="text-[12px] text-[#6b7280] leading-relaxed">{issue.action}</div>
                                      <div className="pt-0.5"><span className={`text-[10px] px-1.5 py-0.5 rounded font-mono font-medium ${issue.confidenceStyle}`}>{issue.confidence}</span></div>
                                      <div className={`text-[11px] font-mono pt-0.5 ${issue.approvalStyle}`}>{issue.approval}</div>
                                    </div>
                                  ))}
                                </div>

                                {/* Bucket: Route to review */}
                                <div className="rounded-lg overflow-hidden border border-border">
                                  <div className="flex items-center justify-between px-4 py-2 bg-[#fffbeb] border-b border-border">
                                    <div className="flex items-center gap-2">
                                      <div className="w-1.5 h-1.5 rounded-full bg-[#d97706] shrink-0" />
                                      <span className="text-[11px] font-semibold text-[#d97706] uppercase tracking-widest font-mono">Route to review</span>
                                      <span className="text-[12px] text-[#6b7280] font-mono">· 385,345 records</span>
                                    </div>
                                    <span className="text-[11px] text-[#d97706]">Mixed confidence · Agent pauses for your input before proceeding</span>
                                  </div>
                                  {[
                                    {
                                      name: 'Invalid document numbers',
                                      count: '24,670',
                                      consequence: 'API check-in failures and advance passenger info rejections',
                                      action: 'Propose format corrections; surface ambiguous cases for manual review',
                                      confidence: 'High',
                                      confidenceStyle: 'bg-[#d1fae5] text-[#059669]',
                                      approval: 'Review required',
                                      approvalStyle: 'text-[#d97706]',
                                    },
                                    {
                                      name: 'Duplicate passenger profiles',
                                      count: '48,230',
                                      consequence: 'Split loyalty history, double check-in risk, revenue attribution errors',
                                      action: 'Identify merge candidates; batch similar cases; present as review set',
                                      confidence: 'Medium',
                                      confidenceStyle: 'bg-[#fffbeb] text-[#d97706]',
                                      approval: 'Review required',
                                      approvalStyle: 'text-[#d97706]',
                                    },
                                    {
                                      name: 'Missing nationality',
                                      count: '312,445',
                                      consequence: 'Regulatory reporting gaps; fails API and advance passenger submission',
                                      action: 'Enrich from booking records where available; flag remainder for spot-check',
                                      confidence: 'Medium',
                                      confidenceStyle: 'bg-[#fffbeb] text-[#d97706]',
                                      approval: 'Spot-check',
                                      approvalStyle: 'text-[#d97706]',
                                    },
                                  ].map((issue, i, arr) => (
                                    <div key={i} className={`grid gap-3 px-4 py-3 bg-white items-start ${i < arr.length - 1 ? 'border-b border-border' : ''}`} style={{ gridTemplateColumns: '1fr 90px 1fr 90px 120px' }}>
                                      <div>
                                        <div className="text-[13px] font-medium text-[#111827]">{issue.name}</div>
                                        <div className="text-[11px] text-[#6b7280] mt-0.5 leading-relaxed">{issue.consequence}</div>
                                      </div>
                                      <div className="text-[13px] font-semibold font-mono text-[#111827] tabular-nums pt-0.5">{issue.count}</div>
                                      <div className="text-[12px] text-[#6b7280] leading-relaxed">{issue.action}</div>
                                      <div className="pt-0.5"><span className={`text-[10px] px-1.5 py-0.5 rounded font-mono font-medium ${issue.confidenceStyle}`}>{issue.confidence}</span></div>
                                      <div className={`text-[11px] font-mono pt-0.5 ${issue.approvalStyle}`}>{issue.approval}</div>
                                    </div>
                                  ))}
                                </div>

                                {/* Bucket: Blocked */}
                                <div className="rounded-lg overflow-hidden border border-[#fca5a5]">
                                  <div className="flex items-center justify-between px-4 py-2 bg-[#fef2f2] border-b border-[#fca5a5]/60">
                                    <div className="flex items-center gap-2">
                                      <div className="w-1.5 h-1.5 rounded-full bg-[#dc2626] shrink-0" />
                                      <span className="text-[11px] font-semibold text-[#dc2626] uppercase tracking-widest font-mono">Blocked — awaiting approval</span>
                                      <span className="text-[12px] text-[#6b7280] font-mono">· 156,880 records</span>
                                    </div>
                                    <span className="text-[11px] text-[#dc2626]">High impact · No changes made until you explicitly approve</span>
                                  </div>
                                  <div className="grid gap-3 px-4 py-3 bg-white items-start" style={{ gridTemplateColumns: '1fr 90px 1fr 90px 120px' }}>
                                    <div>
                                      <div className="text-[13px] font-medium text-[#111827]">Orphaned booking contacts</div>
                                      <div className="text-[11px] text-[#6b7280] mt-0.5 leading-relaxed">Stale links cause lookup failures in check-in and reservation systems</div>
                                    </div>
                                    <div className="text-[13px] font-semibold font-mono text-[#111827] tabular-nums pt-0.5">156,880</div>
                                    <div className="text-[12px] text-[#6b7280] leading-relaxed">Propose deletion of orphan contact links — operation is irreversible without rollback</div>
                                    <div className="pt-0.5"><span className="text-[10px] px-1.5 py-0.5 rounded font-mono font-medium bg-[#f3f4f6] text-[#6b7280]">—</span></div>
                                    <div className="text-[11px] font-mono font-semibold text-[#dc2626] pt-0.5">Approval required</div>
                                  </div>
                                </div>

                              </div>

                              {/* ── Safeguards ── */}
                              <div className="flex items-center gap-2 mb-5 flex-wrap">
                                <span className="text-[10px] text-[#6b7280] uppercase tracking-widest font-mono mr-1">Safeguards</span>
                                {[
                                  { icon: ClipboardList, label: 'Full audit log' },
                                  { icon: RotateCcw,     label: '30-day rollback' },
                                  { icon: Lock,          label: 'Approval gates' },
                                  { icon: FlaskConical,  label: 'Dry run first' },
                                ].map(({ icon: Icon, label }) => (
                                  <span key={label} className="flex items-center gap-1.5 text-[11px] text-[#059669] bg-[#d1fae5] border border-[#6ee7b7] rounded px-2 py-1 font-mono">
                                    <Icon className="size-3" strokeWidth={2} />
                                    {label}
                                  </span>
                                ))}
                              </div>

                              {/* ── CTAs ── */}
                              <div className="flex items-center gap-3">
                                <button className="flex items-center gap-2 px-4 py-2 bg-[#1d4ed8] hover:bg-[#1e40af] text-white rounded-md text-[13px] font-medium transition-colors">
                                  Review AI plan
                                  <ArrowRight className="size-4" strokeWidth={2} />
                                </button>
                                <button className="px-4 py-2 border border-border text-[#374151] hover:bg-[#f3f4f6] rounded-md text-[13px] font-medium transition-colors">
                                  Configure thresholds
                                </button>
                                <button className="text-[13px] text-[#2563eb] hover:text-[#1d4ed8] transition-colors">
                                  Inspect sample records
                                </button>
                              </div>

                            </td>
                          </tr>
                        )}
                      </Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
