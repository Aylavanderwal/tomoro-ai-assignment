import { useState, Fragment, useEffect } from 'react';
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
  Store,
  Network,
  Link2,
  Sparkles,
  CheckCircle,
  Eye,
  ShieldCheck,
  Play,
  Pause,
  Check,
  Edit3,
  SkipForward,
} from 'lucide-react';

type Decision = {
  id: string;
  label: string;
  pattern: string;
  records: number;
  status: 'pending' | 'approved' | 'skipped';
  pausedAt: Date;
  resolvedAt?: Date;
};

const DECISION_TEMPLATES: Omit<Decision, 'id' | 'status' | 'pausedAt'>[] = [
  { label: 'Merge duplicate profiles', pattern: 'Name + DOB + Loyalty ID match', records: 28450 },
  { label: 'Backfill missing nationality', pattern: 'Confidence >85% from passport or booking', records: 12340 },
  { label: 'Resolve loyalty point conflicts', pattern: 'Duplicate points across merged accounts', records: 4210 },
  { label: 'Standardise legacy address formats', pattern: 'Pre-2020 records with non-standard country codes', records: 8920 },
  { label: 'Unresolvable identity conflicts', pattern: 'Multiple source systems disagree on core identity', records: 1900 },
];

type Dataset = {
  id: string;
  name: string;
  domain: string;
  owner: string;
  status: 'Needs attention' | 'Healthy' | 'Processing' | 'Completed' | 'Warning' | 'Needs input' | 'Failed';
  recordsImpacted: string;
  lastUpdated: string;
  statusColor: string;
  bgColor: string;
};

export default function App() {
  const [selectedTab, setSelectedTab] = useState<string>('passengers');
  const [expandedDataset, setExpandedDataset] = useState<string | null>(null);
  const [agentState, setAgentState] = useState<'proposed' | 'running' | 'paused' | 'failed' | 'completed'>('proposed');
  const [progress, setProgress] = useState<number>(0);
  const [pauseCount, setPauseCount] = useState<number>(0);
  const [showToast, setShowToast] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string>('');
  const [showResumeView, setShowResumeView] = useState<boolean>(false);
  const [showActivityLog, setShowActivityLog] = useState<boolean>(false);
  const [startTime] = useState<Date>(new Date());
  const [lastActivityTime, setLastActivityTime] = useState<Date>(new Date());
  const [showSampleModal, setShowSampleModal] = useState<boolean>(false);
  const [showConfidenceBreakdown, setShowConfidenceBreakdown] = useState<boolean>(false);
  const [devMode, setDevMode] = useState<boolean>(false);
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [undoCountdown, setUndoCountdown] = useState<number | null>(null);
  const [completedUpTo, setCompletedUpTo] = useState<number>(0);
  const [failedAtProgress, setFailedAtProgress] = useState<number>(0);

  // Notification system - Three levels of user awareness
  useEffect(() => {
    // Only trigger notifications when agent pauses for user input
    if (agentState === 'paused') {
      // LEVEL 1: In-product toast notification
      // Shows immediately when agent pauses, auto-dismisses after 5s
      // Clicking toast navigates to the paused dataset
      setToastMessage('Agent paused — your input is needed to continue');
      setShowToast(true);
      setTimeout(() => setShowToast(false), 5000);

      // LEVEL 2: Tab title update for background awareness
      // Updates browser tab to show "(1) Action required" when user is on another tab
      // Helps user notice paused state without switching windows
      document.title = '(1) Action required — Data remediation';

      // LEVEL 3: Browser system notification (only for blocking decisions)
      // Requires user to have granted notification permission
      // Only triggered when agent truly cannot proceed without input
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification('AI paused — approval needed to continue', {
          body: 'Duplicate passenger profiles require your decision',
          icon: '/favicon.ico',
          tag: 'ai-remediation', // Tag prevents duplicate notifications
        });
      }
    } else {
      // Reset tab title when not paused
      // No notifications for low-risk processing or completed states
      document.title = 'Passenger Data Operations';
    }
  }, [agentState]);

  // Request notification permission on mount
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  // Undo countdown after approving a policy — ticks down, then clears
  useEffect(() => {
    if (undoCountdown === null) return;
    if (undoCountdown <= 0) { setUndoCountdown(null); return; }
    const t = setTimeout(() => setUndoCountdown(prev => (prev ?? 1) - 1), 1000);
    return () => clearTimeout(t);
  }, [undoCountdown]);

  // Derived decision state
  const resolvedDecisionCount = decisions.filter(d => d.status !== 'pending').length;
  const pendingDecisions = decisions.filter(d => d.status === 'pending');
  const currentPendingDecision = pendingDecisions[0] ?? null;
  const isStruggling = agentState === 'paused' && pauseCount >= 4;

  // Auto-progress when agent is running
  useEffect(() => {
    if (agentState === 'running') {
      const interval = setInterval(() => {
        setProgress((prev) => {
          // First run: pause at 65% to ask for decision
          if (pauseCount === 0 && prev >= 65) {
            clearInterval(interval);
            setTimeout(() => {
              setAgentState('paused');
              setPauseCount(1);
            }, 500);
            return 65;
          }
          // Second run: complete at 100%
          if (pauseCount > 0 && prev >= 100) {
            clearInterval(interval);
            setTimeout(() => {
              setAgentState('completed');
            }, 500);
            return 100;
          }
          // Simulate realistic progress - slow and steady
          if (prev < 20) return prev + 0.5;
          if (prev < 60) return prev + 0.3;
          if (prev < 85) return prev + 0.2;
          return prev + 0.1;
        });
      }, 2000); // Update every 2 seconds

      return () => clearInterval(interval);
    }
  }, [agentState, pauseCount]);

  const datasetsByCategory: Record<string, Dataset[]> = {
    passengers: [
      {
        id: 'passenger-master',
        name: 'Passenger Master',
        domain: 'Customer',
        owner: 'Data Operations',
        status: agentState === 'paused' ? 'Needs input' : agentState === 'running' ? 'Processing' : agentState === 'completed' ? 'Completed' : 'Needs attention',
        recordsImpacted: '1.2M',
        lastUpdated: '2 min ago',
        statusColor: agentState === 'paused' ? 'text-[#d97706]' : agentState === 'running' ? 'text-[#2563eb]' : agentState === 'completed' ? 'text-[#059669]' : 'text-[#d97706]',
        bgColor: agentState === 'paused' ? 'bg-[#fef3c7]' : agentState === 'running' ? 'bg-[#dbeafe]' : agentState === 'completed' ? 'bg-[#d1fae5]' : 'bg-[#fef3c7]',
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

  // Helper functions for time display
  const getElapsedTime = (start: Date): string => {
    const now = new Date();
    const diff = Math.floor((now.getTime() - start.getTime()) / 1000 / 60); // minutes
    if (diff < 60) return `${diff}m`;
    const hours = Math.floor(diff / 60);
    const mins = diff % 60;
    return `${hours}h ${mins}m`;
  };

  const getTimeSince = (time: Date): string => {
    const now = new Date();
    const diff = Math.floor((now.getTime() - time.getTime()) / 1000 / 60); // minutes
    if (diff < 1) return 'Just now';
    if (diff < 60) return `${diff}m ago`;
    const hours = Math.floor(diff / 60);
    return `${hours}h ${diff % 60}m ago`;
  };

  const formatTime = (date: Date): string => {
    return date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="h-screen flex bg-[#fafafa]">
      {/* Sample Resolution Modal */}
      {showSampleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-background rounded-lg border border-border shadow-2xl max-w-3xl w-full mx-4 max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-5 border-b border-border flex items-center justify-between">
              <h3 className="text-[15px] font-medium text-foreground">Sample Resolutions</h3>
              <button
                onClick={() => setShowSampleModal(false)}
                className="text-foreground/40 hover:text-foreground"
              >
                <svg className="size-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-5 overflow-y-auto flex-1">
              <div className="space-y-6">
                {/* Sample 1 */}
                <div className="border border-border rounded-lg overflow-hidden">
                  <div className="bg-[#fafafa] px-4 py-2 border-b border-border">
                    <div className="text-[12px] font-medium text-foreground">Sample Resolution #1 - Date Format Standardization</div>
                    <div className="text-[11px] text-foreground/60">Record: Booking #847392</div>
                  </div>
                  <div className="p-4">
                    <div className="grid grid-cols-2 gap-4 mb-3">
                      <div>
                        <div className="text-[11px] font-medium text-foreground/60 mb-1">BEFORE</div>
                        <div className="px-3 py-2 bg-[#fef2f2] border border-[#fecaca] rounded text-[13px] font-mono">
                          "12/03/2024"
                        </div>
                      </div>
                      <div>
                        <div className="text-[11px] font-medium text-foreground/60 mb-1">AFTER</div>
                        <div className="px-3 py-2 bg-[#f0fdf4] border border-[#bbf7d0] rounded text-[13px] font-mono">
                          "2024-03-12"
                        </div>
                      </div>
                    </div>
                    <div className="space-y-2 text-[12px]">
                      <div>
                        <span className="text-foreground/60">Reason:</span>
                        <span className="text-foreground ml-1">Ambiguous MM/DD vs DD/MM format detected. Converted to ISO-8601 standard based on booking system locale (EU).</span>
                      </div>
                      <div>
                        <span className="text-foreground/60">Source:</span>
                        <span className="text-foreground ml-1">Booking system field 'departure_date'</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-foreground/60">Confidence:</span>
                        <span className="px-2 py-0.5 bg-[#d1fae5] text-[#059669] text-[11px] font-medium rounded">99.2%</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Sample 2 */}
                <div className="border border-border rounded-lg overflow-hidden">
                  <div className="bg-[#fafafa] px-4 py-2 border-b border-border">
                    <div className="text-[12px] font-medium text-foreground">Sample Resolution #2 - Loyalty Tier Sync</div>
                    <div className="text-[11px] text-foreground/60">Record: Passenger LY847392</div>
                  </div>
                  <div className="p-4">
                    <div className="grid grid-cols-2 gap-4 mb-3">
                      <div>
                        <div className="text-[11px] font-medium text-foreground/60 mb-1">BEFORE</div>
                        <div className="px-3 py-2 bg-[#fef2f2] border border-[#fecaca] rounded text-[13px]">
                          tier: <span className="font-mono">"Silver"</span><br/>
                          points: <span className="font-mono">45,820</span>
                        </div>
                      </div>
                      <div>
                        <div className="text-[11px] font-medium text-foreground/60 mb-1">AFTER</div>
                        <div className="px-3 py-2 bg-[#f0fdf4] border border-[#bbf7d0] rounded text-[13px]">
                          tier: <span className="font-mono">"Gold"</span><br/>
                          points: <span className="font-mono">45,820</span>
                        </div>
                      </div>
                    </div>
                    <div className="space-y-2 text-[12px]">
                      <div>
                        <span className="text-foreground/60">Reason:</span>
                        <span className="text-foreground ml-1">Points balance (45,820) exceeds Gold threshold (40,000). Tier updated to match current point total.</span>
                      </div>
                      <div>
                        <span className="text-foreground/60">Source:</span>
                        <span className="text-foreground ml-1">Loyalty platform authoritative tier rules</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-foreground/60">Confidence:</span>
                        <span className="px-2 py-0.5 bg-[#d1fae5] text-[#059669] text-[11px] font-medium rounded">100%</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Sample 3 */}
                <div className="border border-border rounded-lg overflow-hidden">
                  <div className="bg-[#fafafa] px-4 py-2 border-b border-border">
                    <div className="text-[12px] font-medium text-foreground">Sample Resolution #3 - Document Format Correction</div>
                    <div className="text-[11px] text-foreground/60">Record: Passenger profile #2847392</div>
                  </div>
                  <div className="p-4">
                    <div className="grid grid-cols-2 gap-4 mb-3">
                      <div>
                        <div className="text-[11px] font-medium text-foreground/60 mb-1">BEFORE</div>
                        <div className="px-3 py-2 bg-[#fef2f2] border border-[#fecaca] rounded text-[13px] font-mono">
                          "P-123456789"
                        </div>
                      </div>
                      <div>
                        <div className="text-[11px] font-medium text-foreground/60 mb-1">AFTER</div>
                        <div className="px-3 py-2 bg-[#f0fdf4] border border-[#bbf7d0] rounded text-[13px] font-mono">
                          "P123456789"
                        </div>
                      </div>
                    </div>
                    <div className="space-y-2 text-[12px]">
                      <div>
                        <span className="text-foreground/60">Reason:</span>
                        <span className="text-foreground ml-1">Removed invalid hyphen from passport number. UK passports don't contain hyphens.</span>
                      </div>
                      <div>
                        <span className="text-foreground/60">Source:</span>
                        <span className="text-foreground ml-1">ICAO passport validation rules</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-foreground/60">Confidence:</span>
                        <span className="px-2 py-0.5 bg-[#d1fae5] text-[#059669] text-[11px] font-medium rounded">99.8%</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="p-5 border-t border-border bg-[#fafafa]">
              <button
                onClick={() => setShowSampleModal(false)}
                className="px-4 py-2 bg-primary text-primary-foreground rounded text-[13px] font-medium hover:bg-primary/90"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification - In-product alert for paused agent */}
      {showToast && (
        <div className="fixed top-4 right-4 z-50 animate-in slide-in-from-top-2 fade-in duration-300">
          <div
            className="bg-background border border-border rounded-lg shadow-lg p-4 flex items-center gap-3 min-w-[320px] cursor-pointer hover:shadow-xl transition-shadow"
            onClick={() => {
              // Navigate to paused dataset if not already visible
              if (expandedDataset !== 'passenger-master') {
                setExpandedDataset('passenger-master');
              }
              setShowToast(false);
            }}
          >
            <div className="size-8 rounded-full bg-[#fef3c7] flex items-center justify-center shrink-0">
              <Pause className="size-4 text-[#d97706]" strokeWidth={2} />
            </div>
            <div className="flex-1">
              <div className="text-[13px] font-medium text-foreground">
                {toastMessage}
              </div>
              <div className="text-[11px] text-foreground/60 mt-0.5">
                Passenger Master dataset
              </div>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowToast(false);
              }}
              className="text-foreground/40 hover:text-foreground"
            >
              <svg className="size-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Test panel — fixed bottom-right, outside the product UI */}
      {agentState === 'running' && (
        <div className="fixed bottom-4 right-4 z-50 w-64 rounded-lg border border-dashed border-[#94a3b8] bg-white/90 backdrop-blur-sm shadow-lg overflow-hidden">
          <div className="px-3 py-2 border-b border-dashed border-[#94a3b8] bg-[#f8fafc] flex items-center gap-2">
            <div className="size-1.5 rounded-full bg-[#94a3b8]" />
            <span className="text-[10px] font-medium text-[#64748b] uppercase tracking-widest">Test controls</span>
          </div>
          <div className="p-3 space-y-2">
            <button
              onClick={() => {
                const newCount = pauseCount + 1;
                const template = DECISION_TEMPLATES[Math.min(newCount - 1, DECISION_TEMPLATES.length - 1)];
                setDecisions(prev => [...prev, {
                  id: `d-${newCount}`,
                  label: template.label,
                  pattern: template.pattern,
                  records: template.records,
                  status: 'pending',
                  pausedAt: new Date(),
                }]);
                setCompletedUpTo(Math.round(progress * 10) / 10);
                setPauseCount(newCount);
                setAgentState('paused');
              }}
              className="w-full px-3 py-2 text-left text-[12px] font-medium text-[#92400e] bg-[#fef3c7] border border-[#fde68a] rounded hover:bg-[#fde68a] transition-colors flex items-center justify-between"
            >
              <span>Simulate pause</span>
              <span className="text-[10px] text-[#b45309] font-normal">Decision {pauseCount + 1}</span>
            </button>
            <button
              onClick={() => {
                setFailedAtProgress(Math.round(progress * 10) / 10 || 42);
                setAgentState('failed');
              }}
              className="w-full px-3 py-2 text-left text-[12px] font-medium text-[#991b1b] bg-[#fef2f2] border border-[#fecaca] rounded hover:bg-[#fee2e2] transition-colors"
            >
              Simulate failure
            </button>
            <button
              onClick={() => {
                setProgress(100);
                setAgentState('completed');
              }}
              className="w-full px-3 py-2 text-left text-[12px] font-medium text-[#065f46] bg-[#ecfdf5] border border-[#a7f3d0] rounded hover:bg-[#d1fae5] transition-colors"
            >
              Simulate completion
            </button>
          </div>
        </div>
      )}

      {/* Left Sidebar */}
      <div className="w-56 bg-background border-r border-border flex flex-col">
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
          <div className="mt-6 mb-2 px-3 text-[11px] uppercase tracking-wider text-muted-foreground">
            Admin
          </div>
          <div className="space-y-0.5">
            <div className="flex items-center gap-2 px-3 py-2 text-[13px] text-foreground hover:bg-accent rounded-md cursor-pointer">
              <Users className="size-4 text-[#64748b]" strokeWidth={2} />
              <span>Users & Roles</span>
            </div>
            <div className="flex items-center gap-2 px-3 py-2 text-[13px] text-foreground hover:bg-accent rounded-md cursor-pointer">
              <Settings className="size-4 text-[#64748b]" strokeWidth={2} />
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
                className="w-full pl-9 pr-3 py-1.5 text-[13px] bg-[#f8f8f8] border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-ring/20"
              />
            </div>
            <button className="flex items-center gap-2 px-3 py-1.5 text-[13px] text-foreground border border-border rounded-md hover:bg-accent">
              <Filter className="size-4 text-[#6b7280]" strokeWidth={2} />
              <span>Filters</span>
            </button>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-[12px] text-muted-foreground">
              Last sync: 2 min ago
            </span>
            <button className="flex items-center gap-2 px-3 py-1.5 text-[13px] bg-[#3b82f6] text-white rounded-md hover:bg-[#2563eb]">
              <Plus className="size-4" strokeWidth={2} />
              <span>Create rule</span>
            </button>
            <div className="size-8 rounded-full bg-[#e5e7eb] flex items-center justify-center text-[13px] font-medium text-foreground">
              OL
            </div>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-6">
            {/* KPI Row */}
            <div className="grid grid-cols-4 gap-4 mb-6">
              <div className="bg-background border border-border rounded-lg px-4 py-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-[11px] text-muted-foreground uppercase tracking-wide">
                    Active Assets
                  </div>
                  <Database className="size-4 text-[#10b981]" strokeWidth={2} />
                </div>
                <div className="text-[24px] font-medium text-foreground">142</div>
              </div>
              <div className="bg-background border border-border rounded-lg px-4 py-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-[11px] text-muted-foreground uppercase tracking-wide">
                    Open Alerts
                  </div>
                  <AlertTriangle className="size-4 text-[#d97706]" strokeWidth={2} />
                </div>
                <div className="text-[24px] font-medium text-[#d97706]">3</div>
              </div>
              <div className="bg-background border border-border rounded-lg px-4 py-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-[11px] text-muted-foreground uppercase tracking-wide">
                    Jobs Running
                  </div>
                  <Activity className="size-4 text-[#3b82f6]" strokeWidth={2} />
                </div>
                <div className="text-[24px] font-medium text-foreground">8</div>
              </div>
              <div className={`bg-background border rounded-lg px-4 py-3 transition-all ${
                agentState === 'paused' ? 'border-[#d97706] ring-2 ring-[#d97706]/20' : 'border-border'
              }`}>
                <div className="flex items-center justify-between mb-2">
                  <div className="text-[11px] text-muted-foreground uppercase tracking-wide">
                    Awaiting Review
                  </div>
                  <div className="relative">
                    <ListChecks className="size-4 text-[#8b5cf6]" strokeWidth={2} />
                    {agentState === 'paused' && (
                      <div className="absolute -top-1 -right-1 size-2 rounded-full bg-[#d97706] animate-pulse" />
                    )}
                  </div>
                </div>
                <div className={`text-[24px] font-medium ${
                  agentState === 'paused' ? 'text-[#d97706]' : 'text-foreground'
                }`}>
                  {agentState === 'paused' ? 13 : 12}
                </div>
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
            <div className="bg-background border border-border rounded-lg overflow-hidden">
              <div className="px-5 py-3 border-b border-border flex items-center justify-between">
                <h2 className="text-[13px] font-medium text-foreground">
                  {tabs.find((t) => t.id === selectedTab)?.label} Assets
                </h2>
                <div className="text-[12px] text-muted-foreground">
                  {currentDatasets.length} assets
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border bg-[#fafafa]">
                      <th className="w-8 px-3"></th>
                      <th className="px-5 py-2.5 text-left text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
                        Dataset
                      </th>
                      <th className="px-5 py-2.5 text-left text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
                        Domain
                      </th>
                      <th className="px-5 py-2.5 text-left text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
                        Owner
                      </th>
                      <th className="px-5 py-2.5 text-left text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
                        Status
                      </th>
                      <th className="px-5 py-2.5 text-left text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
                        Records
                      </th>
                      <th className="px-5 py-2.5 text-left text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
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
                          className={`border-b border-border cursor-pointer hover:bg-[#fafafa] ${
                            expandedDataset === dataset.id ? 'bg-[#f5f5f5]' : ''
                          } ${
                            dataset.id === 'passenger-master' && agentState === 'paused'
                              ? 'ring-2 ring-[#d97706]/30 ring-inset'
                              : ''
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
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded text-[12px] font-medium ${dataset.bgColor} ${dataset.statusColor}`}
                            >
                              {dataset.status}
                            </span>
                            {dataset.id === 'passenger-master' && agentState === 'proposed' && (
                              <div className="flex items-center gap-1 mt-1">
                                <AlertTriangle className="size-3 text-[#d97706] shrink-0" strokeWidth={2} />
                                <span className="text-[11px] text-foreground/60">579K+ records affected · 5 resolvable patterns, 2 edge cases</span>
                              </div>
                            )}
                          </td>
                          <td className="px-5 py-3 text-[13px] text-foreground">
                            {dataset.recordsImpacted}
                          </td>
                          <td className="px-5 py-3 text-[13px] text-muted-foreground">
                            {dataset.lastUpdated}
                          </td>
                        </tr>
                        {expandedDataset === dataset.id && dataset.id === 'passenger-master' && (
                          <tr className="border-b border-border">
                            <td colSpan={7} className="p-0">
                              <div className="bg-[#fafafa] p-6">
                                <div className="max-w-4xl bg-background border border-border rounded">
                                  {/* Current Status Header */}
                                  <div className="p-5 border-b border-border bg-[#fafafa]">
                                    <div className="flex items-center justify-between">
                                      <div className="flex items-center gap-3">
                                        {/* Status indicator */}
                                        <div
                                          className={`flex items-center justify-center size-8 rounded-full border-2 ${
                                            agentState === 'completed'
                                              ? 'bg-[#059669] border-[#059669]'
                                              : agentState === 'running'
                                              ? 'bg-[#3b82f6] border-[#3b82f6] ring-4 ring-[#3b82f6]/20'
                                              : agentState === 'paused'
                                              ? 'bg-[#d97706] border-[#d97706] ring-4 ring-[#d97706]/20'
                                              : 'bg-background border-border'
                                          }`}
                                        >
                                          {agentState === 'completed' ? (
                                            <CheckCircle className="size-4.5 text-white" strokeWidth={2.5} />
                                          ) : agentState === 'running' ? (
                                            <div className="size-2.5 rounded-full bg-white animate-pulse" />
                                          ) : agentState === 'paused' ? (
                                            <Pause className="size-4 text-white" strokeWidth={2.5} />
                                          ) : (
                                            <Sparkles className="size-4 text-muted-foreground" strokeWidth={2} />
                                          )}
                                        </div>

                                        {/* Status text */}
                                        <div>
                                          <div className="text-[13px] font-medium text-foreground">
                                            {agentState === 'proposed' && 'AI Remediation Proposed'}
                                            {agentState === 'running' && 'Agent Running'}
                                            {agentState === 'paused' && (isStruggling
                                              ? `Agent struggling — Decision ${resolvedDecisionCount + 1} of ${decisions.length}`
                                              : `Decision ${resolvedDecisionCount + 1} of ${decisions.length || 1} pending`
                                            )}
                                            {agentState === 'completed' && 'Remediation Complete'}
                                          </div>
                                          <div className="text-[11px] text-muted-foreground mt-0.5">
                                            {agentState === 'proposed' && `Ready to start · Estimated runtime: 2–4 hours`}
                                            {agentState === 'running' && `Processing 1.2M records · ${Math.round(progress * 10) / 10}% complete`}
                                            {agentState === 'paused' && `Paused ${getTimeSince(new Date(Date.now() - 12 * 60 * 1000))} · Your input needed to continue`}
                                            {agentState === 'completed' && `Finished at 14:32 · Runtime: 3h 47m · All issues resolved`}
                                          </div>
                                        </div>
                                      </div>

                                      {/* Dev mode controls */}
                                      {devMode && (
                                        <div className="flex items-center gap-2">
                                          <span className="text-[10px] text-muted-foreground">Dev:</span>
                                          {(['proposed', 'running', 'paused', 'failed', 'completed'] as const).map((state) => (
                                            <button
                                              key={state}
                                              onClick={() => {
                                                if (state === 'failed') setFailedAtProgress(progress || 42);
                                                setAgentState(state);
                                              }}
                                              className={`px-2 py-1 text-[10px] rounded capitalize ${
                                                agentState === state
                                                  ? 'bg-[#3b82f6] text-white'
                                                  : 'bg-white text-foreground hover:bg-[#e5e7eb] border border-border'
                                              }`}
                                            >
                                              {state}
                                            </button>
                                          ))}
                                        </div>
                                      )}
                                    </div>

                                    {/* Dev mode toggle button */}
                                    <div className="mt-3 pt-3 border-t border-border">
                                      <button
                                        onClick={() => setDevMode(!devMode)}
                                        className={`px-2 py-1 text-[10px] rounded transition-colors ${
                                          devMode
                                            ? 'bg-[#3b82f6] text-white'
                                            : 'bg-white text-foreground border border-border hover:bg-accent'
                                        }`}
                                      >
                                        {devMode ? '✓ Dev Mode' : 'Dev Mode'}
                                      </button>
                                    </div>
                                  </div>

                                  {/* RESUME VIEW - Shows when user returns after being away */}
                                  {showResumeView && (agentState === 'running' || agentState === 'paused' || agentState === 'completed') && (
                                    <>
                                      <div className="p-5 border-b border-border bg-[#f0fdf4]">
                                        <div className="flex items-center gap-2 mb-3">
                                          <Clock className="size-4 text-[#059669]" strokeWidth={2} />
                                          <h3 className="text-[14px] font-medium text-foreground">
                                            {agentState === 'paused' ? 'Agent status: Waiting for your input' :
                                             agentState === 'completed' ? 'Agent status: Complete' :
                                             'Agent status: Running'}
                                          </h3>
                                        </div>

                                        <div className="mb-4 space-y-2 text-[12px]">
                                          <div className="text-foreground/70">
                                            You left 2h 15m ago at {formatTime(new Date(Date.now() - 2 * 60 * 60 * 1000))}
                                          </div>
                                          <div className="font-medium text-foreground">Since then:</div>
                                          <div className="space-y-1.5 ml-4">
                                            <div className="flex items-center gap-2">
                                              <CheckCircle className="size-3.5 text-[#059669]" strokeWidth={2} />
                                              <span className="text-foreground/80">674,657 records processed automatically</span>
                                            </div>
                                            {(agentState === 'completed') && (
                                              <div className="flex items-center gap-2">
                                                <CheckCircle className="size-3.5 text-[#059669]" strokeWidth={2} />
                                                <span className="text-foreground/80">1 policy decision approved by you</span>
                                              </div>
                                            )}
                                            {agentState === 'paused' && (
                                              <div className="flex items-center gap-2">
                                                <Pause className="size-3.5 text-[#d97706]" strokeWidth={2} />
                                                <span className="text-foreground/80">Currently paused on duplicate profiles (28,450 cases)</span>
                                              </div>
                                            )}
                                          </div>
                                        </div>

                                        <div className="flex items-center gap-3">
                                          <button
                                            onClick={() => setShowResumeView(false)}
                                            className="px-4 py-2 text-white rounded text-[13px] font-medium"
                                            style={{
                                              background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)'
                                            }}
                                          >
                                            {agentState === 'paused' ? 'Review and continue' :
                                             agentState === 'completed' ? 'View results' :
                                             'Continue monitoring'}
                                          </button>
                                          <button
                                            onClick={() => {
                                              setShowResumeView(false);
                                              setShowActivityLog(true);
                                            }}
                                            className="text-[13px] text-foreground/60 hover:text-foreground font-medium"
                                          >
                                            View full activity log
                                          </button>
                                        </div>
                                      </div>
                                    </>
                                  )}

                                  {/* STATE 1: PROPOSED APPROACH */}
                                  {agentState === 'proposed' && !showResumeView && (
                                    <>
                                      {/* Header */}
                                      <div className="p-5 border-b border-border">
                                        <h3 className="text-[14px] font-medium text-foreground mb-1">
                                          Proposed data remediation approach
                                        </h3>
                                        <div className="text-[12px] text-foreground/70 mb-3">
                                          1.2M records · Estimated runtime: 2–4 hours · Ready to start at {formatTime(startTime)}
                                        </div>
                                        <div className="flex items-start gap-2 px-3 py-2.5 bg-[#fffbeb] border border-[#fde68a] rounded text-[12px]">
                                          <AlertTriangle className="size-3.5 text-[#d97706] mt-0.5 shrink-0" strokeWidth={2} />
                                          <span className="text-foreground/80">
                                            <span className="font-medium">579K+ records affected across 7 issue patterns.</span>
                                            {' '}AI can resolve 5 patterns automatically (~456K records). 2 edge case patterns will be isolated for manual review.
                                          </span>
                                        </div>
                                      </div>

                                      {/* Low-risk rules */}
                                      <div className="p-5 border-b border-border">
                                        <div className="flex items-center gap-2 mb-3">
                                          <ShieldCheck className="size-4 text-[#059669]" strokeWidth={2} />
                                          <h3 className="text-[13px] font-medium text-foreground">
                                            Low-risk (applied automatically)
                                          </h3>
                                        </div>
                                        <div className="space-y-3">
                                          <div>
                                            <div className="flex items-start gap-2 text-[12px] mb-1">
                                              <CheckCircle className="size-3.5 text-[#059669] mt-0.5 shrink-0" strokeWidth={2} />
                                              <span className="text-foreground/80">Standardise date formats to ISO-8601</span>
                                            </div>
                                            <div className="ml-6 text-[11px] text-foreground/60">
                                              228,467 records · 99.1% avg confidence
                                            </div>
                                          </div>
                                          <div>
                                            <div className="flex items-start gap-2 text-[12px] mb-1">
                                              <CheckCircle className="size-3.5 text-[#059669] mt-0.5 shrink-0" strokeWidth={2} />
                                              <span className="text-foreground/80">Sync loyalty tier from authoritative source</span>
                                            </div>
                                            <div className="ml-6 text-[11px] text-foreground/60">
                                              142,340 records · 98.7% avg confidence
                                            </div>
                                          </div>
                                          <div>
                                            <div className="flex items-start gap-2 text-[12px] mb-1">
                                              <CheckCircle className="size-3.5 text-[#059669] mt-0.5 shrink-0" strokeWidth={2} />
                                              <span className="text-foreground/80">Fix document formatting errors</span>
                                            </div>
                                            <div className="ml-6 text-[11px] text-foreground/60">
                                              86,127 records · 99.8% avg confidence
                                            </div>
                                          </div>
                                        </div>
                                      </div>

                                      {/* Medium-risk patterns */}
                                      <div className="p-5 border-b border-border">
                                        <div className="flex items-center gap-2 mb-3">
                                          <Pause className="size-4 text-[#d97706]" strokeWidth={2} />
                                          <h3 className="text-[13px] font-medium text-foreground">
                                            Medium-risk (requires your approval)
                                          </h3>
                                        </div>
                                        <div className="space-y-2">
                                          <div className="flex items-start gap-2 text-[12px]">
                                            <AlertTriangle className="size-3.5 text-[#d97706] mt-0.5 shrink-0" strokeWidth={2} />
                                            <span className="text-foreground/80">Merge duplicate profiles when name + DOB + loyalty ID match</span>
                                          </div>
                                          <div className="flex items-start gap-2 text-[12px]">
                                            <AlertTriangle className="size-3.5 text-[#d97706] mt-0.5 shrink-0" strokeWidth={2} />
                                            <span className="text-foreground/80">Backfill nationality from booking or passport data when confidence is sufficient</span>
                                          </div>
                                        </div>
                                      </div>

                                      {/* Edge case patterns */}
                                      <div className="p-5 border-b border-border">
                                        <div className="flex items-center justify-between mb-3">
                                          <div className="flex items-center gap-2">
                                            <Shield className="size-4 text-[#7c3aed]" strokeWidth={2} />
                                            <h3 className="text-[13px] font-medium text-foreground">
                                              Edge case patterns — isolated for manual review
                                            </h3>
                                          </div>
                                          <span className="text-[11px] text-foreground/50">2 patterns · ~1,900 records</span>
                                        </div>
                                        <div className="space-y-3">
                                          <div>
                                            <div className="flex items-start gap-2 text-[12px] mb-1">
                                              <Shield className="size-3.5 text-[#7c3aed] mt-0.5 shrink-0" strokeWidth={2} />
                                              <span className="text-foreground/80 font-medium">Records with conflicting identity data across multiple source systems</span>
                                            </div>
                                            <div className="ml-6 text-[11px] text-foreground/60">
                                              Name, DOB, or loyalty ID disagrees between booking, loyalty, and CRM systems — no safe automated resolution possible
                                            </div>
                                          </div>
                                          <div>
                                            <div className="flex items-start gap-2 text-[12px] mb-1">
                                              <Shield className="size-3.5 text-[#7c3aed] mt-0.5 shrink-0" strokeWidth={2} />
                                              <span className="text-foreground/80 font-medium">Records missing critical identity fields with no fallback source available</span>
                                            </div>
                                            <div className="ml-6 text-[11px] text-foreground/60">
                                              Required fields absent in all connected systems — manual enrichment or write-off required
                                            </div>
                                          </div>
                                        </div>
                                      </div>

                                      {/* Reassurance */}
                                      <div className="p-5 border-b border-border bg-[#fafafa]">
                                        <p className="text-[12px] text-foreground font-medium">
                                          The agent will not apply medium- or high-risk actions without your approval.
                                        </p>
                                      </div>

                                      {/* Actions */}
                                      <div className="p-5">
                                        <div className="flex items-center justify-between">
                                          <button className="text-[13px] text-foreground/60 hover:text-foreground font-medium">
                                            Adjust rules
                                          </button>
                                          <button
                                            onClick={() => {
                                              setProgress(0);
                                              setAgentState('running');
                                            }}
                                            className="px-5 py-2.5 text-white rounded text-[13px] font-medium transition-all hover:shadow-md"
                                            style={{
                                              background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)'
                                            }}
                                          >
                                            <div className="flex items-center gap-2">
                                              <Play className="size-4" strokeWidth={2} />
                                              <span>Approve and start processing</span>
                                            </div>
                                          </button>
                                        </div>
                                      </div>
                                    </>
                                  )}

                                  {/* STATE 2: RUNNING LOW-RISK RULES */}
                                  {agentState === 'running' && !showResumeView && (
                                    <>
                                      {/* Header */}
                                      <div className="p-5 border-b border-border">
                                        <div className="flex items-center gap-2 mb-2">
                                          <div className="size-2 rounded-full bg-[#3b82f6] animate-pulse" />
                                          <h3 className="text-[14px] font-medium text-foreground">
                                            Agent running — applying approved low-risk rules
                                          </h3>
                                        </div>
                                        <div className="text-[12px] text-foreground/70">
                                          Running for 47m · Started at {formatTime(startTime)} · Processing ~15K records/min
                                        </div>
                                      </div>

                                      {/* Progress */}
                                      <div className="p-5 border-b border-border">
                                        <div className="mb-3">
                                          <div className="flex items-center justify-between mb-1.5">
                                            <span className="text-[12px] font-medium text-foreground">Overall progress</span>
                                            <span className="text-[12px] text-foreground/70">{Math.round(progress * 10) / 10}%</span>
                                          </div>
                                          <div className="h-2 bg-[#e5e7eb] rounded-full overflow-hidden">
                                            <div
                                              className="h-full bg-[#3b82f6] transition-all duration-300"
                                              style={{ width: `${Math.round(progress * 10) / 10}%` }}
                                            />
                                          </div>
                                        </div>
                                      </div>

                                      {/* Current actions */}
                                      <div className="p-5 border-b border-border">
                                        <div className="flex items-center justify-between mb-3">
                                          <h3 className="text-[13px] font-medium text-foreground">
                                            Current actions
                                          </h3>
                                          <button
                                            onClick={() => setShowSampleModal(true)}
                                            className="text-[12px] text-[#3b82f6] hover:text-[#2563eb] font-medium"
                                          >
                                            View sample resolutions →
                                          </button>
                                        </div>
                                        <div className="space-y-2.5">
                                          <div className="flex items-center gap-2.5 text-[12px]">
                                            <div className="size-1.5 rounded-full bg-[#3b82f6] animate-pulse" />
                                            <span className="text-foreground/80">Standardising date formats… (228,467 records · 99.1% confidence)</span>
                                          </div>
                                          <div className="flex items-center gap-2.5 text-[12px]">
                                            <div className="size-1.5 rounded-full bg-[#3b82f6] animate-pulse" />
                                            <span className="text-foreground/80">Syncing loyalty tier from loyalty platform… (142,340 records · 98.7% confidence)</span>
                                          </div>
                                          <div className="flex items-center gap-2.5 text-[12px]">
                                            <div className="size-1.5 rounded-full bg-[#3b82f6] animate-pulse" />
                                            <span className="text-foreground/80">Correcting document formatting issues… (86,127 records · 99.8% confidence)</span>
                                          </div>
                                        </div>
                                      </div>

                                      {/* Undo countdown banner — shown after approving a policy */}
                                      {undoCountdown !== null && (
                                        <div className="px-5 py-3 border-b border-border bg-[#eff6ff] flex items-center justify-between">
                                          <div className="flex items-center gap-2 text-[13px] text-[#2563eb]">
                                            <CheckCircle className="size-4" strokeWidth={2} />
                                            <span>Policy approved — agent resuming. Undo available for <span className="font-medium">{undoCountdown}s</span>.</span>
                                          </div>
                                          <button
                                            onClick={() => {
                                              setUndoCountdown(null);
                                              setDecisions(prev => {
                                                const lastResolved = [...prev].reverse().find(d => d.status !== 'pending');
                                                if (!lastResolved) return prev;
                                                return prev.map(d => d.id === lastResolved.id
                                                  ? { ...d, status: 'pending', resolvedAt: undefined }
                                                  : d);
                                              });
                                              setAgentState('paused');
                                            }}
                                            className="px-3 py-1.5 text-[12px] font-medium border border-[#93c5fd] text-[#2563eb] rounded hover:bg-[#dbeafe] shrink-0"
                                          >
                                            Undo approval
                                          </button>
                                        </div>
                                      )}

                                      {/* Operations log */}
                                      <div className="p-5">
                                        <button
                                          onClick={() => setShowActivityLog(!showActivityLog)}
                                          className="flex items-center gap-2 text-[13px] font-medium text-foreground mb-3 hover:text-foreground/80"
                                        >
                                          {showActivityLog ? (
                                            <ChevronDown className="size-4" strokeWidth={2} />
                                          ) : (
                                            <ChevronRight className="size-4" strokeWidth={2} />
                                          )}
                                          <span>Activity log (4 events)</span>
                                        </button>
                                        {showActivityLog && (
                                          <div className="space-y-2 ml-6">
                                            <div className="flex items-start gap-3 text-[11px]">
                                              <span className="text-foreground/40 shrink-0 w-12">{formatTime(new Date())}</span>
                                              <div className="flex items-center gap-2 flex-1">
                                                <Activity className="size-3 text-[#3b82f6]" strokeWidth={2} />
                                                <span className="text-foreground/70">Processing low-risk rules</span>
                                              </div>
                                            </div>
                                            <div className="flex items-start gap-3 text-[11px]">
                                              <span className="text-foreground/40 shrink-0 w-12">{formatTime(new Date(Date.now() - 5 * 60 * 1000))}</span>
                                              <div className="flex items-center gap-2 flex-1">
                                                <Check className="size-3 text-[#059669]" strokeWidth={2} />
                                                <span className="text-foreground/70">Low-risk rules loaded · 3 policies active</span>
                                              </div>
                                            </div>
                                            <div className="flex items-start gap-3 text-[11px]">
                                              <span className="text-foreground/40 shrink-0 w-12">{formatTime(new Date(Date.now() - 10 * 60 * 1000))}</span>
                                              <div className="flex items-center gap-2 flex-1">
                                                <Check className="size-3 text-[#059669]" strokeWidth={2} />
                                                <span className="text-foreground/70">Classification complete · 1.2M records scanned</span>
                                              </div>
                                            </div>
                                            <div className="flex items-start gap-3 text-[11px]">
                                              <span className="text-foreground/40 shrink-0 w-12">{formatTime(startTime)}</span>
                                              <div className="flex items-center gap-2 flex-1">
                                                <Play className="size-3 text-foreground/40" strokeWidth={2} />
                                                <span className="text-foreground/70">Agent initialized</span>
                                              </div>
                                            </div>
                                          </div>
                                        )}
                                      </div>
                                    </>
                                  )}

                                  {/* STATE 3: PAUSED FOR DECISION */}
                                  {agentState === 'paused' && !showResumeView && (
                                    <>
                                      {/* Struggling banner — shown when agent has paused 4+ times */}
                                      {isStruggling && (
                                        <div className="p-5 border-b border-border bg-[#fef2f2]">
                                          <div className="flex items-start gap-3">
                                            <AlertTriangle className="size-4 text-[#dc2626] mt-0.5 shrink-0" strokeWidth={2} />
                                            <div>
                                              <div className="text-[13px] font-medium text-[#dc2626] mb-1">
                                                Agent is struggling to make progress
                                              </div>
                                              <p className="text-[12px] text-foreground/70 leading-relaxed">
                                                The agent has paused {pauseCount} times without completing meaningful processing between decisions. This pattern suggests an underlying data quality issue the current ruleset cannot resolve — likely conflicting source systems, ambiguous identity signals, or records outside the scope of the defined rules. Consider reviewing the source data for systemic issues, adjusting confidence thresholds, or escalating to your data engineering team before continuing.
                                              </p>
                                              <div className="flex items-center gap-3 mt-3">
                                                <button
                                                  onClick={() => { setAgentState('proposed'); setProgress(0); setPauseCount(0); setDecisions([]); setCompletedUpTo(0); }}
                                                  className="px-3 py-1.5 text-[12px] font-medium bg-white border border-[#fecaca] text-[#dc2626] rounded hover:bg-[#fee2e2]"
                                                >
                                                  Stop and review data quality
                                                </button>
                                                <span className="text-[12px] text-foreground/40">or</span>
                                                <span className="text-[12px] text-foreground/60">Continue resolving decisions below</span>
                                              </div>
                                            </div>
                                          </div>
                                        </div>
                                      )}

                                      {/* Header */}
                                      <div className={`p-5 border-b border-border ${isStruggling ? 'bg-[#fff8f6]' : 'bg-[#fffbeb]'}`}>
                                        <div className="flex items-center gap-2 mb-2">
                                          <Pause className={`size-4 ${isStruggling ? 'text-[#dc2626]' : 'text-[#d97706]'}`} strokeWidth={2} />
                                          <h3 className="text-[14px] font-medium text-foreground">
                                            {isStruggling ? 'Agent paused — repeated interruptions detected' : 'Agent paused — needs your input to continue'}
                                          </h3>
                                        </div>
                                        <div className="text-[12px] text-foreground/70">
                                          {currentPendingDecision
                                            ? `Paused ${getTimeSince(currentPendingDecision.pausedAt)} · Decision ${resolvedDecisionCount + 1} of ${decisions.length} pending`
                                            : `Paused · Decision 1 of 1 pending`
                                          }
                                        </div>
                                      </div>

                                      {/* Segmented progress bar */}
                                      <div className="p-5 border-b border-border">
                                        <div className="mb-3">
                                          <div className="flex items-center justify-between mb-1.5">
                                            <span className="text-[12px] font-medium text-foreground">Overall progress</span>
                                            <span className="text-[12px] text-foreground/70">{Math.round(progress * 10) / 10}% (paused)</span>
                                          </div>
                                          <div className="h-2 bg-[#e5e7eb] rounded-full overflow-hidden">
                                            <div
                                              className="h-full bg-[#d97706]"
                                              style={{ width: `${Math.round(progress * 10) / 10}%` }}
                                            />
                                          </div>
                                        </div>
                                      </div>

                                      {/* Processing Status Breakdown */}
                                      <div className="p-5 border-b border-border bg-[#fafafa]">
                                        <h3 className="text-[13px] font-medium text-foreground mb-3">
                                          Processing status
                                        </h3>
                                        <div className="space-y-2">
                                          <div className="flex items-center justify-between text-[12px]">
                                            <div className="flex items-center gap-2">
                                              <CheckCircle className="size-3.5 text-[#059669]" strokeWidth={2} />
                                              <span className="text-foreground/80">Low-risk rules</span>
                                            </div>
                                            <span className="text-foreground/60">Complete (228K records)</span>
                                          </div>
                                          <div className="flex items-center justify-between text-[12px]">
                                            <div className="flex items-center gap-2">
                                              <Pause className="size-3.5 text-[#d97706]" strokeWidth={2} />
                                              <span className="text-foreground/80">Medium-risk patterns</span>
                                            </div>
                                            <span className="text-[#d97706]">Paused - needs your decision</span>
                                          </div>
                                          <div className="flex items-center justify-between text-[12px]">
                                            <div className="flex items-center gap-2">
                                              <Shield className="size-3.5 text-[#7c3aed]" strokeWidth={2} />
                                              <span className="text-foreground/80">Edge case patterns</span>
                                            </div>
                                            <span className="text-[#7c3aed]">Queued for manual review</span>
                                          </div>
                                        </div>
                                      </div>

                                      {/* Decision history panel */}
                                      {decisions.length > 0 && (
                                        <div className="p-5 border-b border-border bg-[#fafafa]">
                                          <h3 className="text-[12px] font-medium text-foreground/60 uppercase tracking-wide mb-3">Decision history</h3>
                                          <div className="space-y-2">
                                            {decisions.map((d, i) => (
                                              <div key={d.id} className={`flex items-center justify-between py-2 px-3 rounded border text-[12px] ${
                                                d.status === 'pending'
                                                  ? 'bg-[#fffbeb] border-[#fde68a]'
                                                  : 'bg-background border-border'
                                              }`}>
                                                <div className="flex items-center gap-2.5 flex-1 min-w-0">
                                                  {d.status === 'pending' ? (
                                                    <Pause className="size-3.5 text-[#d97706] shrink-0" strokeWidth={2} />
                                                  ) : d.status === 'approved' ? (
                                                    <CheckCircle className="size-3.5 text-[#059669] shrink-0" strokeWidth={2} />
                                                  ) : (
                                                    <SkipForward className="size-3.5 text-foreground/40 shrink-0" strokeWidth={2} />
                                                  )}
                                                  <div className="min-w-0">
                                                    <span className="font-medium text-foreground truncate block">{i + 1}. {d.label}</span>
                                                    <span className="text-[11px] text-foreground/50">{d.records.toLocaleString()} records</span>
                                                  </div>
                                                </div>
                                                <div className="text-right shrink-0 ml-3">
                                                  {d.status === 'pending' ? (
                                                    <span className="px-2 py-0.5 bg-[#fef3c7] text-[#d97706] text-[11px] font-medium rounded">Pending</span>
                                                  ) : d.status === 'approved' ? (
                                                    <div>
                                                      <span className="px-2 py-0.5 bg-[#d1fae5] text-[#059669] text-[11px] font-medium rounded">Approved</span>
                                                      {d.resolvedAt && <div className="text-[10px] text-foreground/40 mt-0.5">{formatTime(d.resolvedAt)}</div>}
                                                    </div>
                                                  ) : (
                                                    <div>
                                                      <span className="px-2 py-0.5 bg-[#f3f4f6] text-foreground/50 text-[11px] font-medium rounded">Skipped</span>
                                                      {d.resolvedAt && <div className="text-[10px] text-foreground/40 mt-0.5">{formatTime(d.resolvedAt)}</div>}
                                                    </div>
                                                  )}
                                                </div>
                                              </div>
                                            ))}
                                          </div>
                                        </div>
                                      )}

                                      {/* Policy decision card */}
                                      <div className="p-5 border-b border-border">
                                        <div className="flex items-center justify-between mb-3">
                                          <h3 className="text-[13px] font-medium text-foreground">
                                            {currentPendingDecision?.label ?? 'Duplicate passenger profiles'}
                                          </h3>
                                          <div className="px-2 py-1 bg-[#fef3c7] text-[#d97706] text-[11px] font-medium rounded">
                                            Decision {resolvedDecisionCount + 1} of {decisions.length || 1}
                                          </div>
                                        </div>
                                        <p className="text-[11px] text-foreground/60 mb-4">
                                          {currentPendingDecision?.pattern
                                            ? `Pattern: ${currentPendingDecision.pattern} · ${currentPendingDecision.records.toLocaleString()} matching records`
                                            : `Based on initial scan, we've found 2 patterns that need your input. This is the first one.`
                                          }
                                        </p>

                                        <div className="mb-4 space-y-2 text-[12px]">
                                          <div>
                                            <span className="text-foreground/70">Pattern found:</span>
                                            <span className="text-foreground font-medium ml-1">Name, date of birth, and loyalty ID match</span>
                                          </div>
                                          <div>
                                            <span className="text-foreground/70">Risk level:</span>
                                            <span className="text-[#d97706] font-medium ml-1">Medium — affects passenger identity</span>
                                          </div>
                                          <div className="flex items-center gap-2">
                                            <span className="text-foreground/70">Matching cases:</span>
                                            <span className="text-foreground font-medium">28,450 records</span>
                                            <button
                                              onClick={() => setShowConfidenceBreakdown(!showConfidenceBreakdown)}
                                              className="text-[#3b82f6] hover:text-[#2563eb] text-[11px] font-medium"
                                            >
                                              {showConfidenceBreakdown ? 'Hide' : 'View'} confidence breakdown →
                                            </button>
                                          </div>
                                        </div>

                                        {showConfidenceBreakdown && (
                                          <div className="mb-4 p-3 bg-[#fafafa] rounded border border-border">
                                            <div className="text-[11px] font-medium text-foreground/70 mb-2">CONFIDENCE BREAKDOWN</div>
                                            <div className="space-y-2 text-[12px]">
                                              <div className="flex items-center justify-between">
                                                <span className="text-foreground/70">95-100% confidence (can auto-merge)</span>
                                                <span className="font-medium text-foreground">18,340 records</span>
                                              </div>
                                              <div className="flex items-center justify-between">
                                                <span className="text-foreground/70">85-94% confidence (merge with flag)</span>
                                                <span className="font-medium text-foreground">8,210 records</span>
                                              </div>
                                              <div className="flex items-center justify-between">
                                                <span className="text-foreground/70">&lt;85% confidence (manual review)</span>
                                                <span className="font-medium text-[#d97706]">1,900 records</span>
                                              </div>
                                            </div>
                                            <div className="mt-3 pt-3 border-t border-border text-[11px] text-foreground/60">
                                              Confidence based on field similarity, data source reliability, and historical merge accuracy
                                            </div>
                                          </div>
                                        )}

                                        <div className="mb-4">
                                          <div className="text-[11px] font-medium text-foreground/70 mb-3">SAMPLE RECORD PAIR</div>

                                          {/* Detailed comparison card */}
                                          <div className="border border-border rounded-lg overflow-hidden">
                                            <div className="bg-[#fafafa] px-3 py-2 border-b border-border">
                                              <div className="text-[11px] font-medium text-foreground">Record Pair #1 - Likely Duplicate</div>
                                              <div className="text-[10px] text-foreground/60 mt-0.5">
                                                Similarity: 96.8% · Proposed: Merge (keep Profile A as primary)
                                              </div>
                                            </div>
                                            <div className="p-3">
                                              <div className="grid grid-cols-2 gap-3">
                                                {/* Profile A */}
                                                <div className="border border-border rounded p-3 bg-background">
                                                  <div className="text-[10px] font-medium text-foreground/60 mb-2">PROFILE A (Booking System)</div>
                                                  <div className="space-y-1.5 text-[11px]">
                                                    <div className="flex justify-between">
                                                      <span className="text-foreground/60">Name:</span>
                                                      <span className="font-medium">Sarah Chen</span>
                                                    </div>
                                                    <div className="flex justify-between">
                                                      <span className="text-foreground/60">DOB:</span>
                                                      <span className="font-medium">1985-03-14</span>
                                                    </div>
                                                    <div className="flex justify-between">
                                                      <span className="text-foreground/60">Loyalty:</span>
                                                      <span className="font-medium">LY847392</span>
                                                    </div>
                                                    <div className="flex justify-between">
                                                      <span className="text-foreground/60">Email:</span>
                                                      <span className="font-medium text-[#d97706]">sarah.c@email.com</span>
                                                    </div>
                                                    <div className="flex justify-between">
                                                      <span className="text-foreground/60">Bookings:</span>
                                                      <span className="font-medium">12 flights</span>
                                                    </div>
                                                    <div className="flex justify-between">
                                                      <span className="text-foreground/60">Created:</span>
                                                      <span className="font-medium">2019-03-15</span>
                                                    </div>
                                                  </div>
                                                </div>

                                                {/* Profile B */}
                                                <div className="border border-border rounded p-3 bg-background">
                                                  <div className="text-[10px] font-medium text-foreground/60 mb-2">PROFILE B (Loyalty System)</div>
                                                  <div className="space-y-1.5 text-[11px]">
                                                    <div className="flex justify-between">
                                                      <span className="text-foreground/60">Name:</span>
                                                      <span className="font-medium">Sarah Chen</span>
                                                    </div>
                                                    <div className="flex justify-between">
                                                      <span className="text-foreground/60">DOB:</span>
                                                      <span className="font-medium">1985-03-14</span>
                                                    </div>
                                                    <div className="flex justify-between">
                                                      <span className="text-foreground/60">Loyalty:</span>
                                                      <span className="font-medium">LY847392</span>
                                                    </div>
                                                    <div className="flex justify-between">
                                                      <span className="text-foreground/60">Email:</span>
                                                      <span className="font-medium text-[#d97706]">sc2024@email.com</span>
                                                    </div>
                                                    <div className="flex justify-between">
                                                      <span className="text-foreground/60">Points:</span>
                                                      <span className="font-medium">45,820</span>
                                                    </div>
                                                    <div className="flex justify-between">
                                                      <span className="text-foreground/60">Created:</span>
                                                      <span className="font-medium">2024-01-08</span>
                                                    </div>
                                                  </div>
                                                </div>
                                              </div>

                                              {/* Analysis */}
                                              <div className="mt-3 pt-3 border-t border-border space-y-2 text-[11px]">
                                                <div>
                                                  <span className="text-foreground/60">Proposed merge:</span>
                                                  <span className="text-foreground ml-1">Keep Profile A (older, more complete), migrate loyalty points from Profile B</span>
                                                </div>
                                                <div className="flex items-center gap-1">
                                                  <AlertTriangle className="size-3 text-[#d97706]" strokeWidth={2} />
                                                  <span className="text-foreground/60">Conflict:</span>
                                                  <span className="text-foreground ml-1">Email addresses differ (will preserve both in contact history)</span>
                                                </div>
                                                <div className="flex items-center gap-1">
                                                  <CheckCircle className="size-3 text-[#059669]" strokeWidth={2} />
                                                  <span className="text-foreground/60">Confidence:</span>
                                                  <span className="px-2 py-0.5 bg-[#d1fae5] text-[#059669] text-[10px] font-medium rounded">96.8%</span>
                                                </div>
                                              </div>
                                            </div>
                                          </div>
                                        </div>

                                        <div className="mb-4">
                                          <div className="text-[12px] font-medium text-foreground mb-2">Proposed approach</div>
                                          <p className="text-[12px] text-foreground/80">
                                            Merge using most recent active record as primary. Preserve all booking history and loyalty points.
                                          </p>
                                        </div>

                                        <p className="text-[11px] text-muted-foreground mb-4">
                                          Your decision will apply only to cases matching this pattern.
                                        </p>
                                      </div>

                                      {/* Activity log */}
                                      <div className="p-5 border-b border-border">
                                        <button
                                          onClick={() => setShowActivityLog(!showActivityLog)}
                                          className="flex items-center gap-2 text-[13px] font-medium text-foreground mb-3 hover:text-foreground/80"
                                        >
                                          {showActivityLog ? (
                                            <ChevronDown className="size-4" strokeWidth={2} />
                                          ) : (
                                            <ChevronRight className="size-4" strokeWidth={2} />
                                          )}
                                          <span>Activity log (6 events)</span>
                                        </button>
                                        {showActivityLog && (
                                          <div className="space-y-2 ml-6">
                                            <div className="flex items-start gap-3 text-[11px]">
                                              <span className="text-foreground/40 shrink-0 w-12">{formatTime(new Date())}</span>
                                              <div className="flex items-center gap-2 flex-1">
                                                <Pause className="size-3 text-[#d97706]" strokeWidth={2} />
                                                <span className="text-foreground/70">Paused for decision: Duplicate profiles pattern</span>
                                              </div>
                                            </div>
                                            <div className="flex items-start gap-3 text-[11px]">
                                              <span className="text-foreground/40 shrink-0 w-12">{formatTime(new Date(Date.now() - 12 * 60 * 1000))}</span>
                                              <div className="flex items-center gap-2 flex-1">
                                                <Check className="size-3 text-[#059669]" strokeWidth={2} />
                                                <span className="text-foreground/70">Completed: Low-risk rules (228K records processed)</span>
                                              </div>
                                            </div>
                                            <div className="flex items-start gap-3 text-[11px]">
                                              <span className="text-foreground/40 shrink-0 w-12">{formatTime(new Date(Date.now() - 20 * 60 * 1000))}</span>
                                              <div className="flex items-center gap-2 flex-1">
                                                <Check className="size-3 text-[#059669]" strokeWidth={2} />
                                                <span className="text-foreground/70">Started: Processing low-risk rules</span>
                                              </div>
                                            </div>
                                            <div className="flex items-start gap-3 text-[11px]">
                                              <span className="text-foreground/40 shrink-0 w-12">{formatTime(new Date(Date.now() - 30 * 60 * 1000))}</span>
                                              <div className="flex items-center gap-2 flex-1">
                                                <Check className="size-3 text-[#059669]" strokeWidth={2} />
                                                <span className="text-foreground/70">Low-risk rules loaded · 3 policies active</span>
                                              </div>
                                            </div>
                                            <div className="flex items-start gap-3 text-[11px]">
                                              <span className="text-foreground/40 shrink-0 w-12">{formatTime(new Date(Date.now() - 40 * 60 * 1000))}</span>
                                              <div className="flex items-center gap-2 flex-1">
                                                <Check className="size-3 text-[#059669]" strokeWidth={2} />
                                                <span className="text-foreground/70">Classification complete · 1.2M records scanned</span>
                                              </div>
                                            </div>
                                            <div className="flex items-start gap-3 text-[11px]">
                                              <span className="text-foreground/40 shrink-0 w-12">{formatTime(startTime)}</span>
                                              <div className="flex items-center gap-2 flex-1">
                                                <Play className="size-3 text-foreground/40" strokeWidth={2} />
                                                <span className="text-foreground/70">Agent initialized</span>
                                              </div>
                                            </div>
                                          </div>
                                        )}
                                      </div>

                                      {/* Actions */}
                                      <div className="p-5">
                                        <div className="flex items-center justify-end gap-3">
                                          <button
                                            onClick={() => {
                                              if (currentPendingDecision) {
                                                setDecisions(prev => prev.map(d =>
                                                  d.id === currentPendingDecision.id
                                                    ? { ...d, status: 'skipped', resolvedAt: new Date() }
                                                    : d
                                                ));
                                              }
                                              setAgentState('running');
                                            }}
                                            className="text-[13px] text-foreground/60 hover:text-foreground font-medium"
                                          >
                                            Skip for now
                                          </button>
                                          <button className="px-4 py-2 bg-white text-foreground border border-border rounded text-[13px] font-medium hover:bg-accent">
                                            <div className="flex items-center gap-2">
                                              <Edit3 className="size-3.5" strokeWidth={2} />
                                              <span>Modify rule</span>
                                            </div>
                                          </button>
                                          <button
                                            onClick={() => {
                                              if (currentPendingDecision) {
                                                setDecisions(prev => prev.map(d =>
                                                  d.id === currentPendingDecision.id
                                                    ? { ...d, status: 'approved', resolvedAt: new Date() }
                                                    : d
                                                ));
                                              }
                                              setUndoCountdown(30);
                                              setAgentState('running');
                                            }}
                                            className="px-5 py-2.5 text-white rounded text-[13px] font-medium transition-all hover:shadow-md"
                                            style={{
                                              background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)'
                                            }}
                                          >
                                            <div className="flex items-center gap-2">
                                              <Check className="size-4" strokeWidth={2} />
                                              <span>Approve policy</span>
                                            </div>
                                          </button>
                                        </div>
                                      </div>
                                    </>
                                  )}

                                  {/* STATE: FAILED — partial-run failure */}
                                  {agentState === 'failed' && !showResumeView && (
                                    <>
                                      {/* Header */}
                                      <div className="p-5 border-b border-border bg-[#fef2f2]">
                                        <div className="flex items-center gap-2 mb-2">
                                          <AlertTriangle className="size-4 text-[#dc2626]" strokeWidth={2} />
                                          <h3 className="text-[14px] font-medium text-foreground">
                                            Agent stopped — processing error
                                          </h3>
                                        </div>
                                        <div className="text-[12px] text-foreground/70">
                                          Failed at {Math.round(failedAtProgress)}% · {Math.round(failedAtProgress * 12000).toLocaleString()} records processed before failure
                                        </div>
                                      </div>

                                      {/* What completed vs what didn't */}
                                      <div className="p-5 border-b border-border">
                                        <h3 className="text-[13px] font-medium text-foreground mb-3">What happened</h3>
                                        <div className="space-y-3">
                                          <div className="flex items-start gap-3 text-[12px]">
                                            <CheckCircle className="size-4 text-[#059669] mt-0.5 shrink-0" strokeWidth={2} />
                                            <div>
                                              <div className="font-medium text-foreground">Completed before failure</div>
                                              <div className="text-foreground/60 mt-0.5">{Math.round(failedAtProgress * 12000).toLocaleString()} records successfully processed — changes are committed and intact</div>
                                            </div>
                                          </div>
                                          <div className="flex items-start gap-3 text-[12px]">
                                            <AlertTriangle className="size-4 text-[#dc2626] mt-0.5 shrink-0" strokeWidth={2} />
                                            <div>
                                              <div className="font-medium text-foreground">Failure point</div>
                                              <div className="text-foreground/60 mt-0.5">Write conflict detected — loyalty platform returned a version mismatch on record batch #4,820. The agent stopped to prevent overwriting a concurrent update.</div>
                                            </div>
                                          </div>
                                          <div className="flex items-start gap-3 text-[12px]">
                                            <Clock className="size-4 text-foreground/30 mt-0.5 shrink-0" strokeWidth={2} />
                                            <div>
                                              <div className="font-medium text-foreground/60">Not yet processed</div>
                                              <div className="text-foreground/40 mt-0.5">{(1200000 - Math.round(failedAtProgress * 12000)).toLocaleString()} records untouched — no changes made</div>
                                            </div>
                                          </div>
                                        </div>
                                      </div>

                                      {/* Conflicting records notice */}
                                      <div className="p-5 border-b border-border bg-[#fafafa]">
                                        <div className="flex items-center gap-2 mb-2">
                                          <Network className="size-4 text-[#d97706]" strokeWidth={2} />
                                          <h3 className="text-[13px] font-medium text-foreground">Concurrent write conflicts detected</h3>
                                        </div>
                                        <p className="text-[12px] text-foreground/70 mb-3">
                                          While the agent was running, 3 other systems wrote to overlapping records. These records were skipped rather than silently overwritten.
                                        </p>
                                        <div className="space-y-1.5 text-[12px]">
                                          <div className="flex items-center justify-between">
                                            <span className="text-foreground/70">Loyalty platform updates</span>
                                            <span className="font-medium text-foreground">847 records skipped</span>
                                          </div>
                                          <div className="flex items-center justify-between">
                                            <span className="text-foreground/70">Booking system writes</span>
                                            <span className="font-medium text-foreground">234 records skipped</span>
                                          </div>
                                          <div className="flex items-center justify-between">
                                            <span className="text-foreground/70">CRM sync</span>
                                            <span className="font-medium text-foreground">112 records skipped</span>
                                          </div>
                                        </div>
                                        <div className="mt-3 text-[11px] text-foreground/50">
                                          These 1,193 records are queued for manual review — no data was lost.
                                        </div>
                                      </div>

                                      {/* Actions */}
                                      <div className="p-5">
                                        <div className="flex items-center gap-3">
                                          <button
                                            onClick={() => {
                                              setAgentState('running');
                                            }}
                                            className="px-5 py-2.5 text-white rounded text-[13px] font-medium transition-all hover:shadow-md"
                                            style={{ background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)' }}
                                          >
                                            <div className="flex items-center gap-2">
                                              <Play className="size-4" strokeWidth={2} />
                                              <span>Resume from checkpoint</span>
                                            </div>
                                          </button>
                                          <button
                                            onClick={() => {
                                              setAgentState('proposed');
                                              setProgress(0);
                                              setPauseCount(0);
                                              setDecisions([]);
                                              setCompletedUpTo(0);
                                              setFailedAtProgress(0);
                                            }}
                                            className="px-4 py-2 bg-white text-foreground border border-border rounded text-[13px] font-medium hover:bg-accent"
                                          >
                                            Roll back all changes
                                          </button>
                                          <span className="text-[11px] text-foreground/40 ml-auto">Rollback restores {Math.round(failedAtProgress * 12000).toLocaleString()} records to pre-run state</span>
                                        </div>
                                      </div>
                                    </>
                                  )}

                                  {/* STATE 5: COMPLETE */}
                                  {agentState === 'completed' && !showResumeView && (
                                    <>
                                      {/* Header */}
                                      <div className="p-5 border-b border-border bg-[#f0fdf4]">
                                        <div className="flex items-center gap-2 mb-2">
                                          <CheckCircle className="size-4 text-[#059669]" strokeWidth={2} />
                                          <h3 className="text-[14px] font-medium text-foreground">
                                            Remediation complete
                                          </h3>
                                        </div>
                                        <div className="text-[12px] text-foreground/70">
                                          Finished at 14:32 · Runtime: 3h 47m
                                        </div>
                                      </div>

                                      {/* Summary */}
                                      <div className="p-5 border-b border-border">
                                        <div className="flex items-center justify-between mb-3">
                                          <h3 className="text-[13px] font-medium text-foreground">
                                            Summary
                                          </h3>
                                          <button
                                            onClick={() => setShowConfidenceBreakdown(!showConfidenceBreakdown)}
                                            className="text-[12px] text-[#3b82f6] hover:text-[#2563eb] font-medium"
                                          >
                                            {showConfidenceBreakdown ? 'Hide' : 'Show'} confidence breakdown →
                                          </button>
                                        </div>
                                        <div className="grid grid-cols-3 gap-4 mb-4">
                                          <div>
                                            <div className="text-[24px] font-medium text-foreground">674,657</div>
                                            <div className="text-[11px] text-foreground/70 mb-1">Auto-resolved</div>
                                            {showConfidenceBreakdown && (
                                              <div className="space-y-0.5 text-[10px] text-foreground/60">
                                                <div>99-100%: 520K records</div>
                                                <div>95-99%: 124K records</div>
                                                <div>90-95%: 30K records</div>
                                              </div>
                                            )}
                                          </div>
                                          <div>
                                            <div className="text-[24px] font-medium text-foreground">28,340</div>
                                            <div className="text-[11px] text-foreground/70 mb-1">Processed via policy</div>
                                            {showConfidenceBreakdown && (
                                              <div className="space-y-0.5 text-[10px] text-foreground/60">
                                                <div>95-100%: 18,340 merged</div>
                                                <div>85-94%: 8,100 flagged</div>
                                                <div>&lt;85%: 1,900 skipped</div>
                                              </div>
                                            )}
                                          </div>
                                          <div>
                                            <div className="text-[24px] font-medium text-[#d97706]">780</div>
                                            <div className="text-[11px] text-foreground/70 mb-1">Awaiting review</div>
                                            {showConfidenceBreakdown && (
                                              <div className="space-y-0.5 text-[10px] text-[#d97706]">
                                                <div>High-impact: 480</div>
                                                <div>Low confidence: 220</div>
                                                <div>Data conflicts: 80</div>
                                              </div>
                                            )}
                                          </div>
                                        </div>
                                        {showConfidenceBreakdown && (
                                          <div className="p-3 bg-[#fafafa] rounded border border-border text-[11px] text-foreground/70">
                                            <div className="font-medium mb-1">Overall confidence distribution:</div>
                                            <div className="text-[10px]">
                                              99.9% of auto-resolved records had 90%+ confidence. All low-confidence cases (&lt;85%) were routed to manual review.
                                            </div>
                                          </div>
                                        )}
                                      </div>

                                      {/* Operations log */}
                                      <div className="p-5 border-b border-border">
                                        <button
                                          onClick={() => setShowActivityLog(!showActivityLog)}
                                          className="flex items-center gap-2 text-[13px] font-medium text-foreground mb-3 hover:text-foreground/80"
                                        >
                                          {showActivityLog ? (
                                            <ChevronDown className="size-4" strokeWidth={2} />
                                          ) : (
                                            <ChevronRight className="size-4" strokeWidth={2} />
                                          )}
                                          <span>Activity log (15 events)</span>
                                        </button>
                                        {showActivityLog ? (
                                          <div className="space-y-2 ml-6">
                                            <div className="flex items-start gap-3 text-[11px]">
                                              <span className="text-foreground/40 shrink-0 w-12">14:32</span>
                                              <div className="flex items-center justify-between flex-1">
                                                <div className="flex items-center gap-2">
                                                  <CheckCircle className="size-3 text-[#059669]" strokeWidth={2} />
                                                  <span className="text-foreground/70">Remediation complete</span>
                                                </div>
                                                <span className="px-2 py-0.5 bg-[#d1fae5] text-[#059669] text-[10px] font-medium rounded">Done</span>
                                              </div>
                                            </div>
                                            <div className="flex items-start gap-3 text-[11px]">
                                              <span className="text-foreground/40 shrink-0 w-12">14:15</span>
                                              <div className="flex items-center justify-between flex-1">
                                                <div className="flex items-center gap-2">
                                                  <Check className="size-3 text-[#059669]" strokeWidth={2} />
                                                  <span className="text-foreground/70">Duplicate profile merge complete</span>
                                                </div>
                                                <span className="px-2 py-0.5 bg-[#d1fae5] text-[#059669] text-[10px] font-medium rounded">Done</span>
                                              </div>
                                            </div>
                                            <div className="flex items-start gap-3 text-[11px]">
                                              <span className="text-foreground/40 shrink-0 w-12">13:48</span>
                                              <div className="flex items-center gap-2 flex-1">
                                                <Check className="size-3 text-[#3b82f6]" strokeWidth={2} />
                                                <span className="text-foreground/70">Policy approved: Merge duplicate profiles</span>
                                              </div>
                                            </div>
                                            <div className="flex items-start gap-3 text-[11px]">
                                              <span className="text-foreground/40 shrink-0 w-12">13:15</span>
                                              <div className="flex items-center gap-2 flex-1">
                                                <Pause className="size-3 text-[#d97706]" strokeWidth={2} />
                                                <span className="text-foreground/70">Paused for decision: Duplicate profiles pattern</span>
                                              </div>
                                            </div>
                                            <div className="flex items-start gap-3 text-[11px]">
                                              <span className="text-foreground/40 shrink-0 w-12">12:45</span>
                                              <div className="flex items-center justify-between flex-1">
                                                <div className="flex items-center gap-2">
                                                  <Check className="size-3 text-[#059669]" strokeWidth={2} />
                                                  <span className="text-foreground/70">Low-risk processing complete</span>
                                                </div>
                                                <span className="px-2 py-0.5 bg-[#d1fae5] text-[#059669] text-[10px] font-medium rounded">Done</span>
                                              </div>
                                            </div>
                                            <div className="flex items-start gap-3 text-[11px]">
                                              <span className="text-foreground/40 shrink-0 w-12">11:00</span>
                                              <div className="flex items-center gap-2 flex-1">
                                                <Check className="size-3 text-[#059669]" strokeWidth={2} />
                                                <span className="text-foreground/70">Started: Processing low-risk rules</span>
                                              </div>
                                            </div>
                                            <div className="flex items-start gap-3 text-[11px]">
                                              <span className="text-foreground/40 shrink-0 w-12">10:45</span>
                                              <div className="flex items-center gap-2 flex-1">
                                                <Play className="size-3 text-[#3b82f6]" strokeWidth={2} />
                                                <span className="text-foreground/70">Agent initialized</span>
                                              </div>
                                            </div>
                                          </div>
                                        ) : (
                                          <div className="space-y-1.5">
                                            <div className="flex items-center justify-between text-[12px] group">
                                              <div className="flex items-center gap-2">
                                                <Check className="size-3 text-[#059669]" strokeWidth={2} />
                                                <button
                                                  onClick={() => setShowSampleModal(true)}
                                                  className="text-foreground/70 hover:text-foreground hover:underline text-left"
                                                >
                                                  Date format standardization
                                                </button>
                                              </div>
                                              <div className="flex items-center gap-2">
                                                <button
                                                  onClick={() => setShowSampleModal(true)}
                                                  className="text-[11px] text-[#3b82f6] opacity-0 group-hover:opacity-100 transition-opacity"
                                                >
                                                  View examples
                                                </button>
                                                <span className="px-2 py-0.5 bg-[#d1fae5] text-[#059669] text-[11px] font-medium rounded">Done</span>
                                              </div>
                                            </div>
                                            <div className="flex items-center justify-between text-[12px] group">
                                              <div className="flex items-center gap-2">
                                                <Check className="size-3 text-[#059669]" strokeWidth={2} />
                                                <button
                                                  onClick={() => setShowSampleModal(true)}
                                                  className="text-foreground/70 hover:text-foreground hover:underline text-left"
                                                >
                                                  Loyalty tier sync
                                                </button>
                                              </div>
                                              <div className="flex items-center gap-2">
                                                <button
                                                  onClick={() => setShowSampleModal(true)}
                                                  className="text-[11px] text-[#3b82f6] opacity-0 group-hover:opacity-100 transition-opacity"
                                                >
                                                  View examples
                                                </button>
                                                <span className="px-2 py-0.5 bg-[#d1fae5] text-[#059669] text-[11px] font-medium rounded">Done</span>
                                              </div>
                                            </div>
                                            <div className="flex items-center justify-between text-[12px] group">
                                              <div className="flex items-center gap-2">
                                                <Check className="size-3 text-[#059669]" strokeWidth={2} />
                                                <button
                                                  onClick={() => setShowSampleModal(true)}
                                                  className="text-foreground/70 hover:text-foreground hover:underline text-left"
                                                >
                                                  Document formatting fixes
                                                </button>
                                              </div>
                                              <div className="flex items-center gap-2">
                                                <button
                                                  onClick={() => setShowSampleModal(true)}
                                                  className="text-[11px] text-[#3b82f6] opacity-0 group-hover:opacity-100 transition-opacity"
                                                >
                                                  View examples
                                                </button>
                                                <span className="px-2 py-0.5 bg-[#d1fae5] text-[#059669] text-[11px] font-medium rounded">Done</span>
                                              </div>
                                            </div>
                                            <div className="flex items-center justify-between text-[12px]">
                                              <div className="flex items-center gap-2">
                                                <Check className="size-3 text-[#059669]" strokeWidth={2} />
                                                <span className="text-foreground/70">Duplicate profile merge</span>
                                              </div>
                                              <span className="px-2 py-0.5 bg-[#d1fae5] text-[#059669] text-[11px] font-medium rounded">Done</span>
                                            </div>
                                            <div className="flex items-center justify-between text-[12px]">
                                              <div className="flex items-center gap-2">
                                                <Shield className="size-3 text-[#7c3aed]" strokeWidth={2} />
                                                <span className="text-foreground/70">Edge case patterns — manual review</span>
                                              </div>
                                              <span className="px-2 py-0.5 bg-[#ede9fe] text-[#7c3aed] text-[11px] font-medium rounded">Pending</span>
                                            </div>
                                          </div>
                                        )}
                                      </div>

                                      {/* Preview unresolved cases */}
                                      <div className="p-5 border-b border-border bg-[#fffbeb]">
                                        <button
                                          onClick={() => setShowActivityLog(!showActivityLog)}
                                          className="flex items-center gap-2 text-[13px] font-medium text-foreground mb-3 hover:text-foreground/80"
                                        >
                                          {showActivityLog ? (
                                            <ChevronDown className="size-4" strokeWidth={2} />
                                          ) : (
                                            <ChevronRight className="size-4" strokeWidth={2} />
                                          )}
                                          <span>Preview unresolved cases (780 records)</span>
                                        </button>
                                        {showActivityLog && (
                                          <div className="ml-6">
                                            <div className="text-[11px] text-foreground/60 mb-3">Showing 3 examples:</div>
                                            <div className="space-y-2">
                                              <div className="flex items-start gap-2 text-[12px]">
                                                <Shield className="size-3.5 text-[#dc2626] mt-0.5 shrink-0" strokeWidth={2} />
                                                <div>
                                                  <span className="text-foreground font-medium">Conflicting identity:</span>
                                                  <span className="text-foreground/70 ml-1">Sarah Chen has 2 DOBs across systems</span>
                                                </div>
                                              </div>
                                              <div className="flex items-start gap-2 text-[12px]">
                                                <Shield className="size-3.5 text-[#dc2626] mt-0.5 shrink-0" strokeWidth={2} />
                                                <div>
                                                  <span className="text-foreground font-medium">Missing critical data:</span>
                                                  <span className="text-foreground/70 ml-1">Booking #847392 has no passenger name</span>
                                                </div>
                                              </div>
                                              <div className="flex items-start gap-2 text-[12px]">
                                                <Shield className="size-3.5 text-[#dc2626] mt-0.5 shrink-0" strokeWidth={2} />
                                                <div>
                                                  <span className="text-foreground font-medium">Source conflict:</span>
                                                  <span className="text-foreground/70 ml-1">Loyalty tier differs between CRM and booking</span>
                                                </div>
                                              </div>
                                            </div>
                                          </div>
                                        )}
                                      </div>

                                      {/* Action */}
                                      <div className="p-5">
                                        <button
                                          className="px-5 py-2.5 text-white rounded text-[13px] font-medium transition-all hover:shadow-md"
                                          style={{
                                            background: 'linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)'
                                          }}
                                        >
                                          <div className="flex items-center gap-2">
                                            <Eye className="size-4" strokeWidth={2} />
                                            <span>Review edge case patterns (780)</span>
                                          </div>
                                        </button>
                                      </div>
                                    </>
                                  )}
                                </div>
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