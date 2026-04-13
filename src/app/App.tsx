import { useState, Fragment, useEffect, useRef, useCallback } from 'react';
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
  { label: 'Conflicting identity — no shared key', pattern: 'Same traveller detected across 3 source systems with no common field match', records: 8240 },
  { label: 'Travel document nationality ambiguity', pattern: 'Document type conflicts with inferred nationality — policy decision required', records: 3400 },
  { label: 'Minors with incomplete consent records', pattern: 'Passenger age inferred as under 16 — guardian and consent records incomplete or missing', records: 520 },
];

type SubPattern = {
  records: number;
  confidenceLabel: string;
  confidenceColor: string;
  confidenceBg: string;
  signal: string;
  action: string;
  detail: string;
  example: readonly [string, string];
};

const DECISION_SUB_PATTERNS: Record<string, SubPattern[]> = {
  'Conflicting identity — no shared key': [
    { records: 2840, confidenceLabel: '91%', confidenceColor: 'text-[#059669]', confidenceBg: 'bg-[#d1fae5]', signal: 'Name romanisation variant across PNR systems', action: 'Merge · standardise to passport-verified spelling', detail: 'The same traveller appears in Amadeus as "Mohammed Al-Rashidi" and in Sabre as "Mohammad Alrashidy" — a transliteration difference, not a different person. DOB and route history match exactly. The agent identified this as a romanisation variant using multilingual name normalisation; a deterministic rule would have rejected the match due to Levenshtein distance above threshold.', example: ['Amadeus: "Al-Rashidi, M"', 'Sabre: "Alrashidy, Mohammad"'] },
    { records: 2190, confidenceLabel: '84%', confidenceColor: 'text-[#059669]', confidenceBg: 'bg-[#d1fae5]', signal: 'Overlapping flight routes + hotel redemption, no field match', action: 'Flag for human review · strong behavioural signal', detail: 'No individual field matches with confidence above 65%: names differ (first-name variant), DOBs differ by 2 years, email domains differ. However, the agent identified 4 overlapping LHR–DXB booking windows, the same hotel loyalty number across 3 stays, and a shared GDS device fingerprint. Reasoning across flight, hotel, and session data simultaneously is not expressible as a rule.', example: ['Field match: none ≥65%', 'Behavioural: 84% · flag for review'] },
    { records: 1870, confidenceLabel: '76%', confidenceColor: 'text-[#d97706]', confidenceBg: 'bg-[#fef3c7]', signal: 'CS note links orphaned PNR to loyalty profile via maiden name', action: 'Flag as likely same person · human confirmation required', detail: 'The agent read a free-text customer service note on the orphaned profile: "customer mentioned booking under maiden name before marriage — please link to current account." Candidate match has a matching DOB and phone number but a different surname. Understanding the intent of an unstructured note and applying it across a name change is not possible with rule-based deduplication.', example: ['CS note: "old account, maiden name"', 'Candidate: same DOB + phone → 76%'] },
    { records: 1340, confidenceLabel: '72%', confidenceColor: 'text-[#d97706]', confidenceBg: 'bg-[#fef3c7]', signal: 'Identity chain: A=B, B=C, but A≠C directly', action: 'Flag identity cluster · chain confidence below merge threshold', detail: 'PNR record A matches CRM record B at 88% (shared email + DOB). CRM record B matches loyalty record C at 91% (shared phone + address). However, PNR A and loyalty C share no direct field, making the chain confidence 72% — below the merge threshold. The agent surfaced this multi-hop inference; a rule engine cannot reason about transitive identity links across systems.', example: ['A↔B: 88%, B↔C: 91%', 'Chain A↔C: 72% · needs review'] },
  ],
  'Travel document nationality ambiguity': [
    { records: 1240, confidenceLabel: '84%', confidenceColor: 'text-[#059669]', confidenceBg: 'bg-[#d1fae5]', signal: 'Stateless travel document + consistent booking origin', action: 'Infer nationality from 5-year booking history · flag for review', detail: 'The passenger holds a stateless travel document (Convention Travel Document), which carries no nationality field. The agent inferred likely nationality from 5 years of bookings consistently originating from the same country, combined with a billing address and loyalty registration address in the same country. A rule cannot process stateless documents — it has no nationality field to read.', example: ['Document: stateless (CTD)', 'Inferred: "DEU" from booking history → 84%'] },
    { records: 980, confidenceLabel: '77%', confidenceColor: 'text-[#d97706]', confidenceBg: 'bg-[#fef3c7]', signal: '2016 visa nationality conflicts with current booking data', action: 'Flag temporal conflict · which source takes precedence?', detail: 'A 2016 Schengen visa lists nationality as "MAR" (Morocco). However, booking data from 2021 onwards consistently shows UK origin, and a 2022 frequent flyer registration lists address in London. The agent flagged this temporal conflict: the 2016 document may reflect a prior status. A policy decision is needed on whether historical documents or current behavioural signals take precedence for nationality backfill.', example: ['2016 visa: nationality "MAR"', '2022 booking signal: "GBR" → conflict'] },
    { records: 730, confidenceLabel: '71%', confidenceColor: 'text-[#d97706]', confidenceBg: 'bg-[#fef3c7]', signal: 'CS note mentions dual nationality — which to record?', action: 'Flag for policy decision · dual nationality not supported in schema', detail: 'A customer service interaction note reads: "passenger clarified they hold both Irish and Canadian passports — either can be used for booking." The current schema supports a single nationality field. The agent detected this from free text and flagged it: the policy question is which nationality to record as primary, and whether a secondary nationality field should be created. Neither can be resolved by a rule.', example: ['CS note: "Irish and Canadian passports"', 'Schema: single nationality field → policy gap'] },
    { records: 450, confidenceLabel: '68%', confidenceColor: 'text-[#d97706]', confidenceBg: 'bg-[#fef3c7]', signal: 'Refugee travel document — different legal treatment than passport', action: 'Escalate to compliance · cannot auto-backfill', detail: 'The travel document on file is a 1951 Convention refugee travel document. Nationality in this document is legally distinct from the country of issuance and may carry data protection obligations that differ from a standard passport. The agent identified the document type from a scan and flagged it for compliance review — auto-backfill from this document type is not appropriate without legal guidance.', example: ['Document: refugee travel doc (1951)', 'Nationality field: requires compliance review'] },
  ],
  'Minors with incomplete consent records': [
    { records: 184, confidenceLabel: '95%', confidenceColor: 'text-[#d97706]', confidenceBg: 'bg-[#fef3c7]', signal: 'Loyalty account self-registered, DOB indicates passenger is under 16', action: 'Hold — transfer to verified guardian before any processing', detail: 'The loyalty account was created via the website self-registration flow, which does not verify age. The agent inferred the passenger is under 16 from the DOB on the linked booking. Under GDPR Article 8, accounts for under-16s require verifiable parental consent to be lawfully held. This account cannot be processed until a guardian is verified and consent is recorded.', example: ['Self-registered, DOB: 2012-04-03 (age 12)', 'Action: hold · require guardian verification'] },
    { records: 142, confidenceLabel: '97%', confidenceColor: 'text-[#d97706]', confidenceBg: 'bg-[#fef3c7]', signal: 'Child on booking with no adult contact linked', action: 'Cannot process — mandatory guardian contact is missing', detail: 'The booking includes a passenger whose DOB confirms they are under 16, but no adult contact record is linked. Aviation regulations require an adult point of contact for minors. Processing this record without a guardian link would violate the airline\'s duty-of-care policy and regulatory requirements. No automated fix is possible — a staff member must locate and attach the correct guardian contact.', example: ['Passenger DOB: 2013-08-17 (age 10)', 'No adult contact on record → cannot proceed'] },
    { records: 118, confidenceLabel: '91%', confidenceColor: 'text-[#d97706]', confidenceBg: 'bg-[#fef3c7]', signal: 'Guardian consent record present but expired — renewal needed', action: 'Flag for outreach — consent lapsed, cannot process until renewed', detail: 'A guardian consent record exists for this minor, but it was signed more than 2 years ago. The airline\'s data governance policy requires consent renewal every 24 months for minor records. The agent cannot renew consent automatically — this requires a direct outreach message to the guardian on file, who must re-confirm before the record can be processed.', example: ['Consent signed: 2021-11-02 (2+ years ago)', 'Action: send renewal request to guardian'] },
    { records: 76, confidenceLabel: '72%', confidenceColor: 'text-[#d97706]', confidenceBg: 'bg-[#fef3c7]', signal: 'DOB conflicts between booking and loyalty — age is ambiguous', action: 'Cannot proceed — age must be confirmed from a verified document', detail: 'The booking record and loyalty platform carry different dates of birth for this passenger. The two DOBs straddle the age-16 threshold: one indicates 15, the other 17. Whether this passenger is a minor cannot be determined from existing data. Processing as an adult when the passenger may be a minor is not permissible. A staff member must confirm the correct DOB from a verified travel document before any processing can occur.', example: ['Booking DOB: 2009-02-14 (age 15)', 'Loyalty DOB: 2007-02-14 (age 17) → ambiguous'] },
  ],
};

const DECISION_OUTCOMES: Record<string, { headline: string; lines: { variant: 'applied' | 'flagged' | 'escalated'; text: string }[] }> = {
  'Conflicting identity — no shared key': {
    headline: '8,240 records processed — stream resumed',
    lines: [
      { variant: 'applied', text: '2,840 records merged · romanisation variants resolved to passport-verified spelling' },
      { variant: 'flagged', text: '2,190 records queued for human review · strong behavioural signal but no field match' },
      { variant: 'flagged', text: '1,870 records flagged as likely same person · maiden name change, awaiting staff confirmation' },
      { variant: 'flagged', text: '1,340 records isolated · multi-hop identity chain confidence below merge threshold' },
    ],
  },
  'Travel document nationality ambiguity': {
    headline: '3,400 records processed — stream resumed',
    lines: [
      { variant: 'applied', text: '1,240 records: nationality inferred from booking history and address signals, flagged for review' },
      { variant: 'flagged', text: '980 records: temporal conflict noted · 2016 visa vs. current booking origin, logged for decision' },
      { variant: 'flagged', text: '730 records: dual nationality detected in CS notes · policy gap logged, no field written' },
      { variant: 'escalated', text: '450 records: refugee travel documents escalated to compliance team, no auto-backfill' },
    ],
  },
  'Minors with incomplete consent records': {
    headline: '520 records isolated — escalated to data governance team',
    lines: [
      { variant: 'escalated', text: '184 records: hold placed · self-registered under-16 accounts, guardian verification required (GDPR Art. 8)' },
      { variant: 'escalated', text: '142 records: cannot process · no adult contact linked, sent to airport operations team' },
      { variant: 'escalated', text: '118 records: consent lapsed · outreach queued to guardian on file for renewal' },
      { variant: 'escalated', text: '76 records: age ambiguous across systems · staff must confirm from verified travel document' },
    ],
  },
};

type LogEntry = {
  id: string;
  time: Date;
  variant: 'start' | 'progress' | 'decision' | 'approve' | 'skip' | 'block' | 'resume' | 'complete' | 'stream' | 'error';
  text: string;
};

const AUTO_CLEAN_RULES = [
  {
    label: 'Fix date formats',
    records: 228467,
    confidence: 99.1,
    example: ['21-03-1985', '1985-03-21'] as [string, string],
    detail: 'Normalises date strings to ISO 8601 across DOB, booking date, and document expiry fields. Handles 14 format variants detected in this dataset.',
  },
  {
    label: 'Update loyalty tier to match loyalty platform',
    records: 142340,
    confidence: 98.7,
    example: ['PMS: "Silver"', 'Loyalty platform: "Gold" → update PMS'] as [string, string],
    detail: 'Overwrites the PMS loyalty tier with the authoritative value from the loyalty platform where the two systems conflict. Loyalty platform is the source of truth.',
  },
  {
    label: 'Correct travel document field formatting',
    records: 86127,
    confidence: 99.8,
    example: ['GBRGB123456', 'GBR GB123456'] as [string, string],
    detail: 'Standardises document field spacing, character separators, and country code formatting to ICAO Doc 9303 standards.',
  },
] as const;

type StreamDef = { id: string; label: string; description: string; records: number; decisionLabel: string | null; speed: number; };
const STREAMS: StreamDef[] = [
  { id: 'low-risk', label: 'Low-risk auto-cleanup', description: 'Format fixes, field defaults, deduplication at 99%+ confidence', records: 456000, decisionLabel: null, speed: 0.5 },
  { id: 'identity-conflicts', label: 'Conflicting identity — no shared key', description: 'Cross-system identity resolution · 8,240 records', records: 8240, decisionLabel: 'Conflicting identity — no shared key', speed: 0.3 },
  { id: 'nationality-ambiguity', label: 'Travel document nationality ambiguity', description: 'Document nationality policy · 3,400 records', records: 3400, decisionLabel: 'Travel document nationality ambiguity', speed: 0.3 },
  { id: 'minor-consent', label: 'Minors with incomplete consent records', description: 'Minor data compliance · 520 records', records: 520, decisionLabel: 'Minors with incomplete consent records', speed: 0.3 },
];

type TourStep = { id: string; text: string };
const TOUR_STEPS: TourStep[] = [
  {
    id: 'idle',
    text: "This workspace shows the data assets managed by the operations team at a fictional airline. Each row represents a dataset in the platform, showing its health status, owner, and records affected. The passenger master record has been flagged as needing attention. Click on it to open the remediation panel and see what the AI agent has prepared.",
  },
  {
    id: 'proposed',
    text: "The agent has run a preliminary scan across 1.2 million passenger records and categorised them by remediation approach. The top section shows what it can clean automatically at very high confidence, things like date format standardisation and loyalty tier mismatches. Below that are patterns where it expects to pause and ask for your input before proceeding. Review the plan and the 30-day rollback guarantee, then approve to start the run.",
  },
  {
    id: 'adjust-rules',
    text: "Here you can fine-tune which cleaning rules are active before the run begins. Each rule shows a confidence threshold, a record count from the preliminary scan, and an example of the transformation it will apply. Toggling a rule off excludes it from this run entirely, giving you direct control over the agent's autonomy before a single record is touched.",
  },
  {
    id: 'running',
    text: "The agent is now processing the passenger master record, starting with the safest and most confident changes first. Every action is logged in the activity panel in real time so you can always see exactly what is being applied and why. To see how the agent handles a complex edge case that requires your input, click Block agent in the test controls panel on the right.",
  },
  {
    id: 'running-nudge-block',
    text: "The agent has resolved the first edge case and resumed processing. There is one more data conflict in this dataset that will require your input. Click Block agent again in the test controls to surface it and see a different type of issue.",
  },
  {
    id: 'running-nudge-failure',
    text: "Both decision points have been handled and the agent is continuing the cleanup. To explore what happens when the system encounters an unrecoverable error during a run, click Simulate failure in the test controls on the right.",
  },
  {
    id: 'running-nudge-complete',
    text: "The agent has restarted after the failure and is continuing from where it left off. You have now seen the main scenarios in this workflow. Let the run complete to see the final summary, or explore any of the panels you have already reviewed.",
  },
  {
    id: 'failed',
    text: "The agent has encountered a critical error it cannot recover from and has stopped processing. No further changes are being applied to the dataset. From here you can roll back any partial changes that were applied before the failure, or review what was completed before the error occurred.",
  },
  {
    id: 'sample-resolutions',
    text: "This panel shows examples of how the agent transforms individual records. Each example includes the original value, the proposed change, and the confidence score behind the decision. These samples come directly from the preliminary scan and give a concrete sense of the quality and nature of the changes being applied.",
  },
  {
    id: 'blocked',
    text: "The agent has encountered an identity or classification pattern it cannot resolve within its confidence threshold and has surfaced it for your review. Notice that other processing is continuing in the background. Only this specific pattern is paused, keeping the rest of the remediation moving forward. Scroll down to the decision card to review the edge case and approve or skip.",
  },
  {
    id: 'sub-patterns',
    text: "Each flagged pattern is broken into sub-patterns based on the underlying data signals the agent found. Every sub-pattern shows its confidence level, the number of records affected, and a concrete before-and-after example. You can approve the full set with one click, or selectively disable individual sub-patterns you would rather handle outside this run.",
  },
  {
    id: 'completed',
    text: "The run is complete. The summary shows a clear breakdown of what happened: records grouped by how they were handled, auto-resolved, approved by policy, or queued for manual review. Below that, out-of-scope datasets are listed with a reason so nothing looks accidentally skipped. Use the action buttons to review pending cases, download the full audit trail, or browse the cleaned dataset.",
  },
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
  const [agentState, setAgentState] = useState<'proposed' | 'running' | 'blocked' | 'failed' | 'completed'>('proposed');
  const [streamProgress, setStreamProgress] = useState<Record<string, number>>(
    Object.fromEntries(STREAMS.map(s => [s.id, 0]))
  );
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
  const [failedAtProgress, setFailedAtProgress] = useState<number>(0);
  const [expandedRules, setExpandedRules] = useState<Set<number>>(new Set());
  // Tracks which decision cards have their sub-patterns section expanded (closed by default)
  const [expandedDecisionDetails, setExpandedDecisionDetails] = useState<Set<string>>(new Set());
  // Tracks which individual sub-patterns are disabled (key: `${decisionId}-${index}`)
  const [disabledSubPatterns, setDisabledSubPatterns] = useState<Set<string>>(new Set());
  const toggleSubPattern = (key: string) => setDisabledSubPatterns(prev => {
    const next = new Set(prev);
    next.has(key) ? next.delete(key) : next.add(key);
    return next;
  });
  // Adjust rules panel
  const [showBlockedModal, setShowBlockedModal] = useState<boolean>(false);
  const [showAdjustRules, setShowAdjustRules] = useState<boolean>(false);
  const [disabledAutoRules, setDisabledAutoRules] = useState<Set<number>>(new Set());
  const toggleAutoRule = (i: number) => setDisabledAutoRules(prev => {
    const next = new Set(prev); next.has(i) ? next.delete(i) : next.add(i); return next;
  });
  const activeAutoRuleRecords = AUTO_CLEAN_RULES.reduce((sum, r, i) => disabledAutoRules.has(i) ? sum : sum + r.records, 0);

  // Activity log — real events appended as demo progresses
  const [activityLog, setActivityLog] = useState<LogEntry[]>([]);
  const addLog = useCallback((entry: Omit<LogEntry, 'id' | 'time'>) => {
    setActivityLog(prev => [{ ...entry, id: `log-${Date.now()}-${Math.random()}`, time: new Date() }, ...prev]);
  }, []);
  // Tour overlay state
  const [tourVisible, setTourVisible] = useState<boolean>(false);
  const [tourFading, setTourFading] = useState<boolean>(false);
  const [tourWords, setTourWords] = useState<string[]>([]);
  const [tourKey, setTourKey] = useState<number>(0); // bumped to re-trigger word animation
  const [tourDragPos, setTourDragPos] = useState<{ x: number; y: number } | null>(null);
  const lastTourStepRef = useRef<string | null>(null);
  const tourTimeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const dragStateRef = useRef<{ dragging: boolean; moved: boolean; startX: number; startY: number; posX: number; posY: number }>({ dragging: false, moved: false, startX: 0, startY: 0, posX: 0, posY: 0 });
  const [profileImgError, setProfileImgError] = useState<boolean>(false);

  const clearTourTimers = useCallback(() => {
    tourTimeoutsRef.current.forEach(clearTimeout);
    tourTimeoutsRef.current = [];
  }, []);

  const dismissTour = useCallback(() => {
    clearTourTimers();
    setTourFading(true);
    const t = setTimeout(() => { setTourVisible(false); setTourFading(false); }, 350);
    tourTimeoutsRef.current.push(t);
  }, [clearTourTimers]);

  const runTourStep = useCallback((text: string) => {
    clearTourTimers();
    setTourFading(false);
    setTourWords(text.split(' '));
    setTourKey(k => k + 1);
    setTourVisible(true);
  }, [clearTourTimers]);


  // Drag handlers
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dragStateRef.current.dragging) return;
      const dx = e.clientX - dragStateRef.current.startX;
      const dy = e.clientY - dragStateRef.current.startY;
      if (Math.abs(dx) > 4 || Math.abs(dy) > 4) dragStateRef.current.moved = true;
      setTourDragPos({
        x: Math.max(0, Math.min(dragStateRef.current.posX + dx, window.innerWidth - 380)),
        y: Math.max(0, Math.min(dragStateRef.current.posY + dy, window.innerHeight - 100)),
      });
    };
    const onUp = () => { dragStateRef.current.dragging = false; };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, []);

  // Refs to detect transitions
  const prevAgentStateRef = useRef<string>('proposed');
  const prevDecisionsRef = useRef<Decision[]>([]);
  const completedStreamsRef = useRef<Set<string>>(new Set());

  const toggleDecisionDetail = (id: string) => setExpandedDecisionDetails(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  // Request notification permission as soon as the agent starts running
  useEffect(() => {
    if (agentState === 'running' && 'Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, [agentState]);

  // Notification system - Three levels of user awareness
  useEffect(() => {
    // Notify when agent is truly blocked (ran out of safe work)
    if (agentState === 'blocked') {
      // LEVEL 1: In-product toast notification
      setToastMessage('Agent blocked — decisions needed to continue');
      setShowToast(true);
      setTimeout(() => setShowToast(false), 5000);

      // LEVEL 2: Tab title update for background awareness
      document.title = '⚠ Action required — Data remediation';

      // LEVEL 3: Browser system notification
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification('AeroData — Agent blocked', {
          body: 'All remaining records require your input before processing can resume.',
          icon: '/favicon.ico',
          tag: 'ai-remediation-blocked',
          requireInteraction: true,
        });
      }

      // LEVEL 4: Browser alert — for when the tab is in the background
      setTimeout(() => {
        window.alert('AeroData Agent — input required\n\nThe remediation agent is blocked and cannot continue without your input.\n\nReturn to the app to review the queued decisions.');
      }, 100);
    } else if (agentState === 'running' && pendingDecisions.length > 0) {
      document.title = `(${pendingDecisions.length}) Decision${pendingDecisions.length > 1 ? 's' : ''} queued — Data remediation`;
    } else {
      document.title = 'Passenger Data Operations';
    }
  }, [agentState]);

  // Request notification permission on mount
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  // Derived decision state — must be before activeTourStepId
  const pendingDecisions = decisions.filter(d => d.status === 'pending');
  const resolvedDecisionCount = decisions.filter(d => d.status !== 'pending').length;
  const hasSeenFailureRef = useRef<boolean>(false);

  // Track when failure state is seen so tour can sequence correctly
  useEffect(() => {
    if (agentState === 'failed') hasSeenFailureRef.current = true;
  }, [agentState]);

  // Derive which tour step is relevant right now and swap whenever it changes
  const activeTourStepId = (() => {
    if (showSampleModal) return 'sample-resolutions';
    if (expandedDataset !== 'passenger-master') return 'idle';
    if (agentState === 'proposed') return showAdjustRules ? 'adjust-rules' : 'proposed';
    if (agentState === 'failed') return 'failed';
    if (agentState === 'running') {
      if (expandedDecisionDetails.size > 0) return 'sub-patterns';
      if (pendingDecisions.length > 0) return 'blocked';
      if (hasSeenFailureRef.current) return 'running-nudge-complete';
      if (resolvedDecisionCount >= 2) return 'running-nudge-failure';
      if (resolvedDecisionCount === 1) return 'running-nudge-block';
      return 'running';
    }
    if (agentState === 'blocked') return expandedDecisionDetails.size > 0 ? 'sub-patterns' : 'blocked';
    if (agentState === 'completed') return 'completed';
    return null;
  })();

  useEffect(() => {
    if (!activeTourStepId) return;
    if (activeTourStepId === lastTourStepRef.current) return;
    lastTourStepRef.current = activeTourStepId;
    const step = TOUR_STEPS.find(s => s.id === activeTourStepId);
    if (step) runTourStep(step.text);
  }, [activeTourStepId, runTourStep]);

  // Undo countdown after approving a policy — ticks down, then clears
  useEffect(() => {
    if (undoCountdown === null) return;
    if (undoCountdown <= 0) { setUndoCountdown(null); return; }
    const t = setTimeout(() => setUndoCountdown(prev => (prev ?? 1) - 1), 1000);
    return () => clearTimeout(t);
  }, [undoCountdown]);

  // Derived decision state
  const currentPendingDecision = pendingDecisions[0] ?? null;
  const isStruggling = agentState === 'blocked' && pendingDecisions.length >= 4;

  // Streams are "discovered" progressively — low-risk always visible, medium-risk only after their decision surfaces
  const visibleStreams = STREAMS.filter(s =>
    s.decisionLabel === null || decisions.some(d => d.label === s.decisionLabel)
  );

  // Derived overall progress — weighted by record count across discovered streams only
  const totalStreamRecords = visibleStreams.reduce((sum, s) => sum + s.records, 0);
  const progress = totalStreamRecords > 0
    ? visibleStreams.reduce((sum, s) => sum + (streamProgress[s.id] / 100) * s.records, 0) / totalStreamRecords * 100
    : 0;

  // Per-stream progress helper
  const getStreamStatus = (stream: StreamDef) => {
    if (streamProgress[stream.id] >= 100) return 'completed' as const;
    const isBlocked = stream.decisionLabel ? pendingDecisions.some(d => d.label === stream.decisionLabel) : false;
    return isBlocked ? 'blocked' as const : 'running' as const;
  };

  // Auto-progress each stream independently — blocked streams freeze, others continue
  useEffect(() => {
    if (agentState !== 'running') return;
    const pendingLabels = new Set(pendingDecisions.map(d => d.label));
    const interval = setInterval(() => {
      setStreamProgress(prev => {
        const next = { ...prev };
        for (const stream of STREAMS) {
          const isBlocked = stream.decisionLabel ? pendingLabels.has(stream.decisionLabel) : false;
          if (!isBlocked && next[stream.id] < 100) {
            next[stream.id] = Math.min(100, next[stream.id] + stream.speed);
          }
        }
        return next;
      });
    }, 2000);
    return () => clearInterval(interval);
  }, [agentState, pendingDecisions]);

  // Detect completion — all discovered streams at 100%
  useEffect(() => {
    if (agentState !== 'running') return;
    const discovered = STREAMS.filter(s => s.decisionLabel === null || decisions.some(d => d.label === s.decisionLabel));
    if (discovered.length > 0 && discovered.every(s => streamProgress[s.id] >= 100)) {
      setTimeout(() => setAgentState('completed'), 500);
    }
  }, [streamProgress, agentState, decisions]);

  // Detect full block — all discovered streams either blocked or complete, at least one blocked
  useEffect(() => {
    if (agentState !== 'running') return;
    const pendingLabels = new Set(pendingDecisions.map(d => d.label));
    const discovered = STREAMS.filter(s => s.decisionLabel === null || decisions.some(d => d.label === s.decisionLabel));
    const allStalled = discovered.every(s => {
      if (streamProgress[s.id] >= 100) return true;
      if (s.decisionLabel && pendingLabels.has(s.decisionLabel)) return true;
      return false;
    });
    const anyBlocked = discovered.some(s => s.decisionLabel && pendingLabels.has(s.decisionLabel) && streamProgress[s.id] < 100);
    if (allStalled && anyBlocked) {
      setAgentState('blocked');
      setShowBlockedModal(true);
    }
  }, [streamProgress, agentState, pendingDecisions, decisions]);

  // Auto-resume — when a decision is resolved, unblock the agent if any discovered stream can progress
  useEffect(() => {
    if (agentState !== 'blocked') return;
    const pendingLabels = new Set(pendingDecisions.map(d => d.label));
    const discovered = STREAMS.filter(s => s.decisionLabel === null || decisions.some(d => d.label === s.decisionLabel));
    const anyCanProgress = discovered.some(s => {
      if (streamProgress[s.id] >= 100) return false;
      if (s.decisionLabel && pendingLabels.has(s.decisionLabel)) return false;
      return true;
    });
    if (anyCanProgress) setAgentState('running');
  }, [pendingDecisions, agentState, streamProgress, decisions]);

  // Log agent state transitions
  useEffect(() => {
    const prev = prevAgentStateRef.current;
    prevAgentStateRef.current = agentState;
    if (prev === agentState) return;
    if (prev === 'proposed' && agentState === 'running') {
      addLog({ variant: 'start', text: `Agent started · 1.2M records queued · ${AUTO_CLEAN_RULES.filter((_, i) => !disabledAutoRules.has(i)).length} auto-clean rules active` });
    } else if (agentState === 'blocked') {
      addLog({ variant: 'block', text: 'Agent blocked · processed all safe work · waiting for decisions' });
    } else if (prev === 'blocked' && agentState === 'running') {
      addLog({ variant: 'resume', text: 'Agent resumed · unblocked stream now processing' });
    } else if (agentState === 'completed') {
      addLog({ variant: 'complete', text: 'Run complete · all records processed' });
    } else if (agentState === 'failed') {
      addLog({ variant: 'error', text: `Agent stopped — write conflict at ${Math.round(failedAtProgress)}% · safe to retry from checkpoint` });
    }
  }, [agentState]);

  // Log new decisions discovered and status changes
  useEffect(() => {
    const prev = prevDecisionsRef.current;
    // New decisions added
    decisions.forEach(d => {
      const wasPresent = prev.some(p => p.id === d.id);
      if (!wasPresent) {
        addLog({ variant: 'decision', text: `Pattern detected: "${d.label}" · ${d.records.toLocaleString()} records paused` });
      }
    });
    // Status changes
    decisions.forEach(d => {
      const prevD = prev.find(p => p.id === d.id);
      if (prevD && prevD.status === 'pending' && d.status === 'approved') {
        addLog({ variant: 'approve', text: `Decision approved: "${d.label}" · ${d.records.toLocaleString()} records now processing` });
      } else if (prevD && prevD.status === 'pending' && d.status === 'skipped') {
        addLog({ variant: 'skip', text: `Decision skipped: "${d.label}" · ${d.records.toLocaleString()} records deferred` });
      }
    });
    prevDecisionsRef.current = decisions;
  }, [decisions]);

  // Log stream completions
  useEffect(() => {
    if (agentState !== 'running') return;
    STREAMS.forEach(s => {
      if (streamProgress[s.id] >= 100 && !completedStreamsRef.current.has(s.id)) {
        completedStreamsRef.current.add(s.id);
        addLog({ variant: 'stream', text: `Stream complete: "${s.label}" · ${s.records.toLocaleString()} records processed` });
      }
    });
  }, [streamProgress, agentState]);

  const datasetsByCategory: Record<string, Dataset[]> = {
    passengers: [
      {
        id: 'passenger-master',
        name: 'Passenger Master',
        domain: 'Customer',
        owner: 'Data Operations',
        status: agentState === 'blocked' ? 'Needs input' : agentState === 'running' ? 'Processing' : agentState === 'completed' ? 'Completed' : 'Needs attention',
        recordsImpacted: '1.2M',
        lastUpdated: '2 min ago',
        statusColor: agentState === 'blocked' ? 'text-[#d97706]' : agentState === 'running' ? 'text-[#2563eb]' : agentState === 'completed' ? 'text-[#059669]' : 'text-[#d97706]',
        bgColor: agentState === 'blocked' ? 'bg-[#fef3c7]' : agentState === 'running' ? 'bg-[#dbeafe]' : agentState === 'completed' ? 'bg-[#d1fae5]' : 'bg-[#fef3c7]',
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
      {/* Tour voiceover bubble */}
      <style>{`@keyframes twFadeWord { from { opacity: 0; transform: translateY(3px); } to { opacity: 1; transform: translateY(0); } }`}</style>
      {tourVisible && (
        <div
          className="fixed z-[70] flex items-end gap-3 cursor-grab active:cursor-grabbing select-none"
          style={{
            left: tourDragPos ? tourDragPos.x : 20,
            bottom: tourDragPos ? 'auto' : 24,
            top: tourDragPos ? tourDragPos.y : 'auto',
            opacity: tourFading ? 0 : 1,
            transition: tourFading ? 'opacity 350ms ease-in' : 'opacity 250ms ease-out',
          }}
          onMouseDown={e => {
            dragStateRef.current = {
              dragging: true,
              moved: false,
              startX: e.clientX,
              startY: e.clientY,
              posX: tourDragPos?.x ?? 20,
              posY: tourDragPos?.y ?? (window.innerHeight - 24 - 120),
            };
            e.preventDefault();
          }}
          onClick={() => {
            if (!dragStateRef.current.moved) dismissTour();
          }}
        >
          {/* Avatar */}
          <div className="size-10 rounded-full overflow-hidden border-2 border-white shadow-lg shrink-0 bg-[#1e293b] flex items-center justify-center">
            {!profileImgError ? (
              <img src="/profile.jpg" alt="Ayla" className="size-full object-cover" onError={() => setProfileImgError(true)} />
            ) : (
              <span className="text-[13px] font-semibold text-white select-none">AW</span>
            )}
          </div>

          {/* Bubble */}
          <div
            className="relative max-w-[300px] rounded-2xl rounded-bl-sm px-4 py-3 shadow-xl"
            style={{ background: '#1e293b' }}
          >
            <div className="absolute -left-1.5 bottom-4 size-3 rotate-45 rounded-sm" style={{ background: '#1e293b' }} />
            <p className="text-[12.5px] leading-relaxed text-white/90 relative z-10">
              {tourWords.map((word, i) => (
                <span
                  key={`${tourKey}-${i}`}
                  style={{
                    display: 'inline',
                    opacity: 0,
                    animation: `twFadeWord 200ms ease forwards ${i * 70}ms`,
                  }}
                >
                  {word}{i < tourWords.length - 1 ? ' ' : ''}
                </span>
              ))}
            </p>
            <div className="mt-2 text-[10px] text-white/25 text-right">click to dismiss</div>
          </div>
        </div>
      )}

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

      {/* Blocked modal — full overlay, fires on both blocks */}
      {showBlockedModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-background rounded-xl border border-border shadow-2xl w-full max-w-sm mx-4 overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Header stripe */}
            <div className="bg-[#d97706] px-5 py-3 flex items-center gap-3">
              <div className="size-8 rounded-full bg-white/20 flex items-center justify-center shrink-0">
                <Pause className="size-4 text-white" strokeWidth={2.5} />
              </div>
              <div>
                <div className="text-[13px] font-semibold text-white">Agent requires your input</div>
                <div className="text-[11px] text-white/70">AeroData · Passenger Master Record</div>
              </div>
            </div>
            {/* Body */}
            <div className="px-5 py-4">
              <p className="text-[13px] text-foreground/80 leading-relaxed mb-4">
                The remediation agent has processed all records it can handle automatically and is now blocked. It cannot continue until you review the queued decisions.
              </p>
              <div className="p-3 bg-[#fef3c7] rounded-lg border border-[#fde68a] mb-4">
                <div className="text-[12px] font-medium text-[#92400e] mb-1">
                  {pendingDecisions.length} decision{pendingDecisions.length !== 1 ? 's' : ''} waiting
                </div>
                <div className="text-[11px] text-[#78350f]">
                  {pendingDecisions.map(d => d.label).join(' · ')}
                </div>
              </div>
              <button
                onClick={() => {
                  setShowBlockedModal(false);
                  setExpandedDataset('passenger-master');
                }}
                className="w-full py-2.5 rounded-lg text-[13px] font-medium text-white"
                style={{ background: 'linear-gradient(135deg, #d97706 0%, #b45309 100%)' }}
              >
                Review decisions →
              </button>
              <button
                onClick={() => setShowBlockedModal(false)}
                className="w-full mt-2 py-2 text-[12px] text-foreground/50 hover:text-foreground/70"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Test panel — fixed bottom-right, outside the product UI */}
      {(agentState === 'running' || agentState === 'blocked') && (
        <div className="fixed bottom-4 right-4 z-50 w-72 rounded-lg border border-dashed border-[#94a3b8] bg-white/90 backdrop-blur-sm shadow-lg overflow-hidden">
          <div className="px-3 py-2 border-b border-dashed border-[#94a3b8] bg-[#f8fafc] flex items-center gap-2">
            <div className="size-1.5 rounded-full bg-[#94a3b8]" />
            <span className="text-[10px] font-medium text-[#64748b] uppercase tracking-widest">Test controls</span>
          </div>
          <div className="p-3 space-y-2">
            {/* Block agent — surfaces the next LLM challenge one at a time */}
            {agentState === 'running' && (() => {
              const alreadyDiscovered = new Set(decisions.map(d => d.label));
              const next = DECISION_TEMPLATES.find(t => !alreadyDiscovered.has(t.label));
              if (!next) return null;
              return (
                <button
                  onClick={() => {
                    setDecisions(prev => [...prev, {
                      id: `d-block-${Date.now()}`,
                      label: next.label,
                      pattern: next.pattern,
                      records: next.records,
                      status: 'pending' as const,
                      pausedAt: new Date(Date.now() - 8 * 60 * 1000),
                    }]);
                  }}
                  className="w-full px-3 py-2 text-left text-[12px] font-medium text-[#92400e] bg-[#fff7ed] border border-[#fed7aa] rounded hover:bg-[#ffedd5] transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <span>Block agent</span>
                    <span className="text-[10px] text-[#9a3412] font-normal truncate ml-2 max-w-[140px]">{next.label}</span>
                  </div>
                </button>
              );
            })()}
            {agentState === 'blocked' && (
              <button
                onClick={() => setAgentState('running')}
                className="w-full px-3 py-2 text-left text-[12px] font-medium text-[#065f46] bg-[#ecfdf5] border border-[#a7f3d0] rounded hover:bg-[#d1fae5] transition-colors"
              >
                Unblock agent
                <span className="text-[10px] text-[#047857] font-normal ml-2">resume running</span>
              </button>
            )}
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
                setStreamProgress(Object.fromEntries(STREAMS.map(s => [s.id, 100])));
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
                agentState === 'blocked' ? 'border-[#d97706] ring-2 ring-[#d97706]/20' :
                (agentState === 'running' && pendingDecisions.length > 0) ? 'border-[#d97706]/50' : 'border-border'
              }`}>
                <div className="flex items-center justify-between mb-2">
                  <div className="text-[11px] text-muted-foreground uppercase tracking-wide">
                    Awaiting Review
                  </div>
                  <div className="relative">
                    <ListChecks className="size-4 text-[#8b5cf6]" strokeWidth={2} />
                    {(agentState === 'blocked' || (agentState === 'running' && pendingDecisions.length > 0)) && (
                      <div className="absolute -top-1 -right-1 size-2 rounded-full bg-[#d97706] animate-pulse" />
                    )}
                  </div>
                </div>
                <div className={`text-[24px] font-medium ${
                  (agentState === 'blocked' || (agentState === 'running' && pendingDecisions.length > 0)) ? 'text-[#d97706]' : 'text-foreground'
                }`}>
                  {pendingDecisions.length > 0 ? 12 + pendingDecisions.length : 12}
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
                          {...(dataset.id === 'passenger-master' ? { 'data-tour-anchor': 'tour-passenger-row' } : {})}
                          className={`border-b border-border cursor-pointer hover:bg-[#fafafa] ${
                            expandedDataset === dataset.id ? 'bg-[#f5f5f5]' : ''
                          } ${
                            dataset.id === 'passenger-master' && agentState === 'blocked'
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
                                <span className="text-[11px] text-foreground/60">Issues found in preliminary scan · agent will assess during run</span>
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
                                              : agentState === 'blocked'
                                              ? 'bg-[#d97706] border-[#d97706] ring-4 ring-[#d97706]/20'
                                              : 'bg-background border-border'
                                          }`}
                                        >
                                          {agentState === 'completed' ? (
                                            <CheckCircle className="size-4.5 text-white" strokeWidth={2.5} />
                                          ) : agentState === 'running' ? (
                                            <div className="size-2.5 rounded-full bg-white animate-pulse" />
                                          ) : agentState === 'blocked' ? (
                                            <Pause className="size-4 text-white" strokeWidth={2.5} />
                                          ) : (
                                            <Sparkles className="size-4 text-muted-foreground" strokeWidth={2} />
                                          )}
                                        </div>

                                        {/* Status text */}
                                        <div>
                                          <div className="text-[13px] font-medium text-foreground">
                                            {agentState === 'proposed' && 'AI Remediation Proposed'}
                                            {agentState === 'running' && pendingDecisions.length === 0 && 'Agent Running'}
                                            {agentState === 'running' && pendingDecisions.length > 0 && `Agent Running · ${pendingDecisions.length} decision${pendingDecisions.length > 1 ? 's' : ''} queued`}
                                            {agentState === 'blocked' && (isStruggling
                                              ? 'Agent struggling — decisions unresolved'
                                              : `Agent blocked — ${pendingDecisions.length} decision${pendingDecisions.length > 1 ? 's' : ''} required to continue`
                                            )}
                                            {agentState === 'completed' && 'Remediation Complete'}
                                          </div>
                                          <div className="text-[11px] text-muted-foreground mt-0.5">
                                            {agentState === 'proposed' && `Ready to start · Estimated runtime: 2–4 hours`}
                                            {agentState === 'running' && pendingDecisions.length === 0 && `Processing 1.2M records · ${Math.round(progress * 10) / 10}% complete`}
                                            {agentState === 'running' && pendingDecisions.length > 0 && `${Math.round(progress * 10) / 10}% complete · Processing unaffected records while decisions queue`}
                                            {agentState === 'blocked' && `Stopped at ${Math.round(progress * 10) / 10}% · All remaining records require your input`}
                                            {agentState === 'completed' && `Finished at 14:32 · Runtime: 3h 47m · All issues resolved`}
                                          </div>
                                        </div>
                                      </div>

                                      {/* Dev mode controls */}
                                      {devMode && (
                                        <div className="flex items-center gap-2">
                                          <span className="text-[10px] text-muted-foreground">Dev:</span>
                                          {(['proposed', 'running', 'blocked', 'failed', 'completed'] as const).map((state) => (
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
                                  {showResumeView && (agentState === 'running' || agentState === 'blocked' || agentState === 'completed') && (
                                    <>
                                      {/* Priority banner — what needs attention right now */}
                                      {agentState === 'blocked' && (
                                        <div className="px-5 py-4 border-b border-[#fde68a] bg-[#fffbeb]">
                                          <div className="flex items-start gap-3">
                                            <div className="size-8 rounded-full bg-[#fef3c7] border border-[#fde68a] flex items-center justify-center shrink-0 mt-0.5">
                                              <Pause className="size-4 text-[#d97706]" strokeWidth={2} />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                              <div className="text-[14px] font-medium text-foreground mb-0.5">
                                                Agent is waiting for you — {pendingDecisions.length} decision{pendingDecisions.length > 1 ? 's' : ''} blocking progress
                                              </div>
                                              <div className="text-[12px] text-foreground/60">
                                                Oldest waiting {pendingDecisions[0] ? getTimeSince(pendingDecisions[0].pausedAt) : ''} · No records can be processed until you respond
                                              </div>
                                            </div>
                                          </div>
                                        </div>
                                      )}
                                      {agentState === 'running' && pendingDecisions.length > 0 && (
                                        <div className="px-5 py-4 border-b border-[#bfdbfe] bg-[#eff6ff]">
                                          <div className="flex items-start gap-3">
                                            <div className="size-8 rounded-full bg-[#dbeafe] border border-[#bfdbfe] flex items-center justify-center shrink-0 mt-0.5">
                                              <AlertTriangle className="size-4 text-[#2563eb]" strokeWidth={2} />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                              <div className="text-[14px] font-medium text-foreground mb-0.5">
                                                Agent still running — {pendingDecisions.length} decision{pendingDecisions.length > 1 ? 's' : ''} queued while you were away
                                              </div>
                                              <div className="text-[12px] text-foreground/60">
                                                Other streams are continuing · Queued decisions need your review
                                              </div>
                                            </div>
                                          </div>
                                        </div>
                                      )}
                                      {agentState === 'completed' && (
                                        <div className="px-5 py-4 border-b border-[#bbf7d0] bg-[#f0fdf4]">
                                          <div className="flex items-start gap-3">
                                            <div className="size-8 rounded-full bg-[#d1fae5] border border-[#a7f3d0] flex items-center justify-center shrink-0 mt-0.5">
                                              <CheckCircle className="size-4 text-[#059669]" strokeWidth={2} />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                              <div className="text-[14px] font-medium text-foreground mb-0.5">
                                                Run complete — all records processed
                                              </div>
                                              <div className="text-[12px] text-foreground/60">
                                                Finished at 14:32 · Total runtime: 3h 47m
                                              </div>
                                            </div>
                                          </div>
                                        </div>
                                      )}
                                      {(agentState === 'running' && pendingDecisions.length === 0) && (
                                        <div className="px-5 py-4 border-b border-[#bfdbfe] bg-[#eff6ff]">
                                          <div className="flex items-start gap-3">
                                            <div className="size-8 rounded-full bg-[#dbeafe] border border-[#bfdbfe] flex items-center justify-center shrink-0 mt-0.5">
                                              <div className="size-2 rounded-full bg-[#2563eb] animate-pulse" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                              <div className="text-[14px] font-medium text-foreground mb-0.5">
                                                Agent running — no action needed yet
                                              </div>
                                              <div className="text-[12px] text-foreground/60">
                                                {Math.round(progress)}% complete · Processing ~15K records/min
                                              </div>
                                            </div>
                                          </div>
                                        </div>
                                      )}

                                      {/* What happened while away */}
                                      <div className="px-5 py-4 border-b border-border">
                                        <div className="text-[11px] font-medium text-foreground/40 uppercase tracking-wide mb-3">
                                          While you were away · 2h 15m
                                        </div>
                                        <div className="space-y-2.5">
                                          <div className="flex items-start gap-3 text-[12px]">
                                            <CheckCircle className="size-3.5 text-[#059669] mt-0.5 shrink-0" strokeWidth={2} />
                                            <span className="text-foreground/80">
                                              {visibleStreams.find(s => s.id === 'low-risk') && streamProgress['low-risk'] > 20
                                                ? `${Math.round(streamProgress['low-risk'] * 4560).toLocaleString()} records cleaned automatically — format fixes, field defaults, deduplication`
                                                : '456,000 records cleaned automatically — format fixes, field defaults, deduplication'}
                                            </span>
                                          </div>
                                          {decisions.filter(d => d.status !== 'pending').length > 0 && (
                                            <div className="flex items-start gap-3 text-[12px]">
                                              <CheckCircle className="size-3.5 text-[#059669] mt-0.5 shrink-0" strokeWidth={2} />
                                              <span className="text-foreground/80">
                                                {decisions.filter(d => d.status !== 'pending').length} decision{decisions.filter(d => d.status !== 'pending').length > 1 ? 's' : ''} you approved{decisions.filter(d => d.status !== 'pending').length > 0 ? ` — ${decisions.filter(d => d.status !== 'pending').reduce((sum, d) => sum + d.records, 0).toLocaleString()} records now processing` : ''}
                                              </span>
                                            </div>
                                          )}
                                          {pendingDecisions.length > 0 && (
                                            <div className="flex items-start gap-3 text-[12px]">
                                              <Pause className="size-3.5 text-[#d97706] mt-0.5 shrink-0" strokeWidth={2} />
                                              <span className="text-foreground/80">
                                                {pendingDecisions.length} new pattern{pendingDecisions.length > 1 ? 's' : ''} flagged — {pendingDecisions.reduce((sum, d) => sum + d.records, 0).toLocaleString()} records waiting on your decision
                                              </span>
                                            </div>
                                          )}
                                          {agentState === 'completed' && (
                                            <div className="flex items-start gap-3 text-[12px]">
                                              <CheckCircle className="size-3.5 text-[#059669] mt-0.5 shrink-0" strokeWidth={2} />
                                              <span className="text-foreground/80">All streams finished — run completed successfully</span>
                                            </div>
                                          )}
                                        </div>
                                      </div>

                                      {/* Action row */}
                                      <div className="px-5 py-4 flex items-center gap-3">
                                        <button
                                          onClick={() => setShowResumeView(false)}
                                          className="px-4 py-2 text-white rounded text-[13px] font-medium"
                                          style={{
                                            background: agentState === 'blocked'
                                              ? 'linear-gradient(135deg, #d97706 0%, #b45309 100%)'
                                              : agentState === 'completed'
                                              ? 'linear-gradient(135deg, #059669 0%, #047857 100%)'
                                              : 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)'
                                          }}
                                        >
                                          {agentState === 'blocked' ? `Review ${pendingDecisions.length} decision${pendingDecisions.length > 1 ? 's' : ''} →` :
                                           agentState === 'completed' ? 'View results →' :
                                           pendingDecisions.length > 0 ? 'Review queued decisions →' :
                                           'Continue monitoring'}
                                        </button>
                                        <button
                                          onClick={() => {
                                            setShowResumeView(false);
                                            setShowActivityLog(true);
                                          }}
                                          className="text-[13px] text-foreground/50 hover:text-foreground font-medium"
                                        >
                                          Full activity log
                                        </button>
                                      </div>
                                    </>
                                  )}

                                  {/* ADJUST RULES PANEL */}
                                  {agentState === 'proposed' && showAdjustRules && (
                                    <>
                                      <div className="p-5 border-b border-border flex items-center justify-between" data-tour-anchor="tour-adjust-rules">
                                        <div>
                                          <h3 className="text-[14px] font-medium text-foreground">Adjust cleaning rules</h3>
                                          <p className="text-[12px] text-foreground/50 mt-0.5">Toggle any rule off to exclude it from this run. All enabled rules apply automatically with no approval needed.</p>
                                        </div>
                                        <button onClick={() => setShowAdjustRules(false)} className="text-[12px] text-foreground/50 hover:text-foreground font-medium shrink-0 ml-4">← Back</button>
                                      </div>
                                      <div className="divide-y divide-border">
                                        {AUTO_CLEAN_RULES.map((rule, i) => {
                                          const isEnabled = !disabledAutoRules.has(i);
                                          return (
                                            <div key={i} className={`p-5 transition-opacity ${isEnabled ? '' : 'opacity-50'}`}>
                                              <div className="flex items-start gap-3">
                                                <button
                                                  onClick={() => toggleAutoRule(i)}
                                                  className="mt-0.5 shrink-0"
                                                  title={isEnabled ? 'Disable this rule' : 'Enable this rule'}
                                                >
                                                  <div className={`size-4 rounded border-2 flex items-center justify-center transition-colors ${isEnabled ? 'border-[#3b82f6] bg-[#3b82f6]' : 'border-foreground/20 bg-transparent'}`}>
                                                    {isEnabled && <Check className="size-3 text-white" strokeWidth={3} />}
                                                  </div>
                                                </button>
                                                <div className="flex-1 min-w-0">
                                                  <div className="flex items-center gap-2 flex-wrap mb-1">
                                                    <span className="text-[13px] font-medium text-foreground">{rule.label}</span>
                                                    <span className="px-1.5 py-0.5 bg-[#d1fae5] text-[#059669] text-[10px] font-medium rounded">{rule.confidence}% confidence</span>
                                                  </div>
                                                  <div className="text-[11px] text-foreground/50 mb-2">{rule.records.toLocaleString()} records in scope · {rule.detail}</div>
                                                  <div className="flex items-center gap-2 text-[11px]">
                                                    <span className="text-foreground/40">e.g.</span>
                                                    <span className="px-2 py-0.5 bg-[#fef2f2] border border-[#fecaca] rounded font-mono text-[#dc2626] text-[10px]">{rule.example[0]}</span>
                                                    <span className="text-foreground/30">→</span>
                                                    <span className="px-2 py-0.5 bg-[#f0fdf4] border border-[#bbf7d0] rounded font-mono text-[#059669] text-[10px]">{rule.example[1]}</span>
                                                  </div>
                                                </div>
                                              </div>
                                            </div>
                                          );
                                        })}
                                      </div>
                                      <div className="p-5 border-t border-border bg-[#fafafa]">
                                        <div className="flex items-center justify-between">
                                          <div className="text-[12px] text-foreground/60">
                                            {AUTO_CLEAN_RULES.length - disabledAutoRules.size} of {AUTO_CLEAN_RULES.length} rules active ·{' '}
                                            <span className="font-medium text-foreground">{activeAutoRuleRecords.toLocaleString()} records</span> in scope
                                          </div>
                                          <button
                                            onClick={() => setShowAdjustRules(false)}
                                            className="px-4 py-2 text-white rounded text-[13px] font-medium"
                                            style={{ background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)' }}
                                          >
                                            Confirm and return
                                          </button>
                                        </div>
                                      </div>
                                    </>
                                  )}

                                  {/* STATE 1: PROPOSED APPROACH */}
                                  {agentState === 'proposed' && !showResumeView && !showAdjustRules && (
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
                                            <span className="font-medium">The majority of records can be cleaned automatically.</span>
                                            {' '}Based on a preliminary scan, the patterns below look straightforward. The agent will surface anything it cannot resolve confidently as it encounters it, and wait for your input before acting.
                                          </span>
                                        </div>
                                      </div>

                                      {/* Auto-cleaning rules */}
                                      <div className="p-5 border-b border-border">
                                        <div className="flex items-center gap-2 mb-1">
                                          <ShieldCheck className="size-4 text-[#059669]" strokeWidth={2} />
                                          <h3 className="text-[13px] font-medium text-foreground">
                                            Applied automatically — no approval needed
                                          </h3>
                                        </div>
                                        <p className="text-[11px] text-foreground/50 mb-3 ml-6">All 98–99%+ confidence. Structural and formatting issues only — no passenger merges, no deletions, no identity changes.</p>
                                        <div className="space-y-3">
                                          <div>
                                            <div className="flex items-start gap-2 text-[12px] mb-1">
                                              <CheckCircle className="size-3.5 text-[#059669] mt-0.5 shrink-0" strokeWidth={2} />
                                              <span className="text-foreground/80">Fix date formats <span className="text-foreground/40 font-normal">(e.g. "21-03-1985" → "1985-03-21")</span></span>
                                            </div>
                                            <div className="ml-6 text-[11px] text-foreground/50">~228K records in preliminary scan · 99.1% confidence</div>
                                          </div>
                                          <div>
                                            <div className="flex items-start gap-2 text-[12px] mb-1">
                                              <CheckCircle className="size-3.5 text-[#059669] mt-0.5 shrink-0" strokeWidth={2} />
                                              <span className="text-foreground/80">Update loyalty tier to match the loyalty platform <span className="text-foreground/40 font-normal">(e.g. Silver → Gold where loyalty system is authoritative)</span></span>
                                            </div>
                                            <div className="ml-6 text-[11px] text-foreground/50">~142K records in preliminary scan · 98.7% confidence</div>
                                          </div>
                                          <div>
                                            <div className="flex items-start gap-2 text-[12px] mb-1">
                                              <CheckCircle className="size-3.5 text-[#059669] mt-0.5 shrink-0" strokeWidth={2} />
                                              <span className="text-foreground/80">Correct travel document field formatting <span className="text-foreground/40 font-normal">(e.g. "GBRGB123456" → "GBR GB123456")</span></span>
                                            </div>
                                            <div className="ml-6 text-[11px] text-foreground/50">~86K records in preliminary scan · 99.8% confidence</div>
                                          </div>
                                        </div>
                                      </div>

                                      {/* Will pause for your decision */}
                                      <div className="p-5 border-b border-border">
                                        <div className="flex items-center gap-2 mb-1">
                                          <Pause className="size-4 text-[#d97706]" strokeWidth={2} />
                                          <h3 className="text-[13px] font-medium text-foreground">
                                            May pause for your decision
                                          </h3>
                                        </div>
                                        <p className="text-[11px] text-foreground/50 mb-3 ml-6">The agent will flag ambiguous cases as it finds them — it cannot predict all of them in advance. Based on a preliminary scan, patterns like the ones below are likely to come up. Each will be explained in full before you're asked to act.</p>
                                        <div className="space-y-4">
                                          <div>
                                            <div className="flex items-start gap-2 text-[12px] mb-1">
                                              <AlertTriangle className="size-3.5 text-[#d97706] mt-0.5 shrink-0" strokeWidth={2} />
                                              <span className="text-foreground/80 font-medium">The same passenger appearing across multiple systems with no matching field</span>
                                            </div>
                                            <div className="ml-6 text-[11px] text-foreground/50 leading-relaxed">
                                              Seen in preliminary scan · resolved by inference from behavioural signals and service notes, not deterministic fields
                                            </div>
                                          </div>
                                          <div>
                                            <div className="flex items-start gap-2 text-[12px] mb-1">
                                              <AlertTriangle className="size-3.5 text-[#d97706] mt-0.5 shrink-0" strokeWidth={2} />
                                              <span className="text-foreground/80 font-medium">Nationality unclear from the travel document on file</span>
                                            </div>
                                            <div className="ml-6 text-[11px] text-foreground/50 leading-relaxed">
                                              Seen in preliminary scan · stateless documents, expired visas, dual nationality — policy decision needed
                                            </div>
                                          </div>
                                        </div>
                                      </div>

                                      {/* Edge cases requiring manual review */}
                                      <div className="p-5 border-b border-border">
                                        <div className="flex items-center gap-2 mb-1">
                                          <Shield className="size-4 text-[#7c3aed]" strokeWidth={2} />
                                          <h3 className="text-[13px] font-medium text-foreground">
                                            Some records may be escalated — agent cannot resolve them
                                          </h3>
                                        </div>
                                        <p className="text-[11px] text-foreground/50 mb-3 ml-6">If records are found that no automated action can safely resolve, they will be isolated and flagged for the appropriate team. No changes will be made to them.</p>
                                        <div>
                                          <div className="flex items-start gap-2 text-[12px] mb-1">
                                            <Shield className="size-3.5 text-[#7c3aed] mt-0.5 shrink-0" strokeWidth={2} />
                                            <span className="text-foreground/80 font-medium">Minor passengers with incomplete or expired guardian consent</span>
                                          </div>
                                          <div className="ml-6 text-[11px] text-foreground/50 leading-relaxed">
                                            Seen in preliminary scan · GDPR Article 8 and aviation duty-of-care obligations require human verification — cannot be resolved automatically
                                          </div>
                                        </div>
                                      </div>

                                      {/* Reassurance + audit */}
                                      <div className="p-5 border-b border-border bg-[#fafafa] space-y-2">
                                        <p className="text-[12px] text-foreground font-medium">
                                          The agent will not make changes to paused or escalated records until you confirm.
                                        </p>
                                        <div className="flex items-center gap-2 text-[11px] text-foreground/60">
                                          <CheckCircle className="size-3.5 text-[#059669] shrink-0" strokeWidth={2} />
                                          <span>Every change is logged with a timestamp and the reason it was made. Any approved action can be reversed up to 30 days after the run completes.</span>
                                        </div>
                                      </div>

                                      {/* Actions */}
                                      <div className="p-5" data-tour-anchor="tour-proposed-actions">
                                        <div className="flex items-center justify-between">
                                          <button
                                            onClick={() => setShowAdjustRules(true)}
                                            className="text-[13px] text-foreground/60 hover:text-foreground font-medium"
                                          >
                                            {disabledAutoRules.size > 0
                                              ? `Adjust rules (${AUTO_CLEAN_RULES.length - disabledAutoRules.size} of ${AUTO_CLEAN_RULES.length} active)`
                                              : 'Adjust rules'
                                            }
                                          </button>
                                          <button
                                            onClick={() => {
                                              setStreamProgress(Object.fromEntries(STREAMS.map(s => [s.id, 0])));
                                              setDecisions([]);
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
                                            {pendingDecisions.length > 0
                                              ? `Agent running — ${STREAMS.filter(s => getStreamStatus(s) === 'blocked').length} stream${STREAMS.filter(s => getStreamStatus(s) === 'blocked').length > 1 ? 's' : ''} paused, ${STREAMS.filter(s => getStreamStatus(s) === 'running').length} active`
                                              : 'Agent running — processing all streams'
                                            }
                                          </h3>
                                        </div>
                                        <div className="text-[12px] text-foreground/70">
                                          Running for 47m · Started at {formatTime(startTime)} · Processing ~15K records/min
                                        </div>
                                      </div>

                                      {/* Progress — per-stream breakdown */}
                                      <div className="p-5 border-b border-border">
                                        {/* Overall bar */}
                                        <div className="flex items-center justify-between mb-1.5">
                                          <span className="text-[12px] font-medium text-foreground">Overall progress</span>
                                          <span className="text-[12px] text-foreground/70">{Math.round(progress * 10) / 10}%</span>
                                        </div>
                                        <div className="h-1.5 bg-[#e5e7eb] rounded-full overflow-hidden mb-4">
                                          <div className="h-full bg-[#3b82f6] transition-all duration-500" style={{ width: `${Math.round(progress * 10) / 10}%` }} />
                                        </div>
                                        {/* Stream breakdown — only shown once medium-risk patterns have been surfaced */}
                                        {visibleStreams.length > 1 && (
                                        <div className="space-y-2.5" data-tour-anchor="tour-stream-progress">
                                          {visibleStreams.map(stream => {
                                            const sp = Math.round(streamProgress[stream.id]);
                                            const status = getStreamStatus(stream);
                                            const resolvedDecision = stream.decisionLabel
                                              ? decisions.find(d => d.label === stream.decisionLabel && d.status !== 'pending')
                                              : null;
                                            return (
                                              <div key={stream.id} className="flex items-center gap-2.5">
                                                <div className="w-40 shrink-0 flex items-center gap-1.5">
                                                  {status === 'completed'
                                                    ? <CheckCircle className="size-3 text-[#059669] shrink-0" strokeWidth={2} />
                                                    : status === 'blocked'
                                                      ? <Pause className="size-3 text-[#d97706] shrink-0" strokeWidth={2} />
                                                      : <div className="size-2 rounded-full bg-[#3b82f6] animate-pulse shrink-0" />
                                                  }
                                                  <div className="min-w-0">
                                                    <span className={`text-[11px] font-medium truncate block ${status === 'blocked' ? 'text-[#92400e]' : status === 'completed' ? 'text-foreground/40' : 'text-foreground'}`}>
                                                      {stream.label}
                                                    </span>
                                                    {resolvedDecision && (
                                                      <span className="text-[10px] text-foreground/35">
                                                        {resolvedDecision.status === 'approved' ? 'decision applied' : 'skipped'}
                                                      </span>
                                                    )}
                                                  </div>
                                                </div>
                                                <div className="flex-1 h-1.5 bg-[#e5e7eb] rounded-full overflow-hidden">
                                                  <div
                                                    className={`h-full transition-all duration-500 ${status === 'blocked' ? 'bg-[#d97706]' : status === 'completed' ? 'bg-[#059669]' : 'bg-[#3b82f6]'}`}
                                                    style={{ width: `${sp}%` }}
                                                  />
                                                </div>
                                                <span className={`text-[11px] w-7 text-right shrink-0 ${status === 'blocked' ? 'text-[#d97706]' : 'text-foreground/40'}`}>{sp}%</span>
                                                <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium shrink-0 w-14 text-center ${
                                                  status === 'completed' ? 'bg-[#d1fae5] text-[#059669]'
                                                  : status === 'blocked' ? 'bg-[#fef3c7] text-[#d97706]'
                                                  : 'bg-[#dbeafe] text-[#2563eb]'
                                                }`}>
                                                  {status === 'completed' ? 'Done' : status === 'blocked' ? 'Paused' : 'Active'}
                                                </span>
                                              </div>
                                            );
                                          })}
                                        </div>
                                        )}
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

                                      {/* Decision queue — pending only, disappears once all resolved */}
                                      {pendingDecisions.length > 0 && (
                                        <div className="border-b border-border">
                                          <div className="px-5 py-3 bg-[#fffbeb] border-b border-[#fde68a] flex items-center justify-between" data-tour-anchor="tour-decision-queue">
                                            <div className="flex items-center gap-2">
                                              <AlertTriangle className="size-3.5 text-[#d97706]" strokeWidth={2} />
                                              <span className="text-[12px] font-medium text-[#92400e]">
                                                {pendingDecisions.length} decision{pendingDecisions.length > 1 ? 's' : ''} queued — agent is still processing other records
                                              </span>
                                            </div>
                                            <span className="text-[11px] text-foreground/50">Resolve at your own pace</span>
                                          </div>
                                          <div className="divide-y divide-border">
                                            {decisions.map((decision) => {
                                              if (decision.status !== 'pending') return null;
                                              /* pending decision card below */
                                              const subPatterns = DECISION_SUB_PATTERNS[decision.label];
                                              const isDetailOpen = expandedDecisionDetails.has(decision.id);
                                              const isMinors = decision.label === 'Minors with incomplete consent records';
                                              const enabledCount = subPatterns ? subPatterns.filter((_, i) => !disabledSubPatterns.has(`${decision.id}-${i}`)).length : null;
                                              const approveLabel = isMinors
                                                ? 'Escalate to review'
                                                : (enabledCount !== null && enabledCount < subPatterns!.length)
                                                  ? `Approve (${enabledCount} of ${subPatterns!.length})`
                                                  : 'Approve';
                                              return (
                                                <div key={decision.id} className="bg-background">
                                                  {/* Decision card header */}
                                                  <div className="px-5 py-3 flex items-center justify-between">
                                                    <div className="flex items-center gap-3 min-w-0">
                                                      <div className="size-2 rounded-full bg-[#d97706] shrink-0" />
                                                      <div className="min-w-0">
                                                        <div className="text-[12px] font-medium text-foreground">{decision.label}</div>
                                                        <div className="text-[11px] text-foreground/50">{decision.records.toLocaleString()} records · found {getTimeSince(decision.pausedAt)}</div>
                                                      </div>
                                                    </div>
                                                    <div className="flex items-center gap-2 shrink-0 ml-4">
                                                      <button
                                                        onClick={() => setDecisions(prev => prev.map(d =>
                                                          d.id === decision.id ? { ...d, status: 'skipped', resolvedAt: new Date() } : d
                                                        ))}
                                                        className="px-3 py-1.5 text-[12px] text-foreground/60 hover:text-foreground font-medium border border-border rounded hover:bg-accent"
                                                      >
                                                        Skip
                                                      </button>
                                                      <button
                                                        onClick={() => {
                                                          setDecisions(prev => prev.map(d =>
                                                            d.id === decision.id ? { ...d, status: 'approved', resolvedAt: new Date() } : d
                                                          ));
                                                          setUndoCountdown(30);
                                                        }}
                                                        className="px-3 py-1.5 text-[12px] font-medium text-white rounded whitespace-nowrap"
                                                        style={{ background: isMinors ? 'linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)' : 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)' }}
                                                      >
                                                        {approveLabel}
                                                      </button>
                                                    </div>
                                                  </div>
                                                  {/* Sub-patterns section — collapsed by default */}
                                                  {subPatterns && (
                                                    <div className="px-5 pb-4" data-tour-anchor="tour-sub-patterns">
                                                      <button
                                                        onClick={() => toggleDecisionDetail(decision.id)}
                                                        className="flex items-center gap-1.5 text-[11px] text-foreground/60 hover:text-foreground mb-2"
                                                      >
                                                        {isDetailOpen ? <ChevronDown className="size-3" strokeWidth={2} /> : <ChevronRight className="size-3" strokeWidth={2} />}
                                                        <span>{decision.records.toLocaleString()} records across {subPatterns.length} sub-patterns — expand to review before approving</span>
                                                      </button>
                                                      {isDetailOpen && (
                                                        <div className="border border-border rounded-lg overflow-hidden divide-y divide-border">
                                                          {subPatterns.map((rule, i) => {
                                                            const ruleKey = `${decision.id}-${i}`;
                                                            const isRuleOpen = expandedRules.has(i) && decision.label === 'Conflicting identity — no shared key';
                                                            const isDisabled = disabledSubPatterns.has(ruleKey);
                                                            return (
                                                              <div key={i} className={`${isRuleOpen ? 'bg-[#fafafa]' : 'bg-background hover:bg-[#fafafa]'} ${isDisabled ? 'opacity-40' : ''}`}>
                                                                <div className="flex items-center">
                                                                  <button
                                                                    onClick={() => toggleSubPattern(ruleKey)}
                                                                    className="px-3 py-3 shrink-0 flex items-center justify-center border-r border-border hover:bg-accent"
                                                                    title={isDisabled ? 'Enable sub-pattern' : 'Disable sub-pattern'}
                                                                  >
                                                                    <div className={`size-3.5 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${isDisabled ? 'border-foreground/20 bg-transparent' : 'border-[#3b82f6] bg-[#3b82f6]'}`}>
                                                                      {!isDisabled && <Check className="size-2.5 text-white" strokeWidth={3} />}
                                                                    </div>
                                                                  </button>
                                                                  <button
                                                                    onClick={() => {
                                                                      if (decision.label === 'Conflicting identity — no shared key') {
                                                                        setExpandedRules(prev => { const next = new Set(prev); next.has(i) ? next.delete(i) : next.add(i); return next; });
                                                                      }
                                                                    }}
                                                                    className="flex-1 px-4 py-3 flex items-center gap-3 text-left"
                                                                  >
                                                                    {decision.label === 'Conflicting identity — no shared key'
                                                                      ? (isRuleOpen ? <ChevronDown className="size-3.5 text-foreground/40 shrink-0" strokeWidth={2} /> : <ChevronRight className="size-3.5 text-foreground/40 shrink-0" strokeWidth={2} />)
                                                                      : <div className="size-3.5 shrink-0" />
                                                                    }
                                                                    <div className="flex-1 min-w-0">
                                                                      <div className="flex items-center gap-2 flex-wrap">
                                                                        <span className="text-[12px] font-medium text-foreground">{rule.signal}</span>
                                                                        <span className={`px-1.5 py-0.5 ${rule.confidenceBg} ${rule.confidenceColor} text-[10px] font-medium rounded`}>{rule.confidenceLabel}</span>
                                                                      </div>
                                                                      <div className="text-[11px] text-foreground/50 mt-0.5">{rule.action}</div>
                                                                    </div>
                                                                    <span className="text-[11px] text-foreground/40 shrink-0 mr-3">{rule.records.toLocaleString()} records</span>
                                                                  </button>
                                                                  <div className="px-3 shrink-0 border-l border-border">
                                                                    <button className="text-[11px] text-[#3b82f6] hover:text-[#2563eb] font-medium whitespace-nowrap py-3">Modify →</button>
                                                                  </div>
                                                                </div>
                                                                {isRuleOpen && (
                                                                  <div className="px-4 pb-4 pt-1 ml-6 space-y-3">
                                                                    <p className="text-[12px] text-foreground/70 leading-relaxed">{rule.detail}</p>
                                                                    <div className="flex items-center gap-2 text-[11px]">
                                                                      <span className="text-foreground/50">Example:</span>
                                                                      <span className="px-2 py-0.5 bg-[#fef2f2] border border-[#fecaca] rounded font-mono text-[#dc2626]">{rule.example[0]}</span>
                                                                      <span className="text-foreground/40">→</span>
                                                                      <span className="px-2 py-0.5 bg-[#f0fdf4] border border-[#bbf7d0] rounded font-mono text-[#059669]">{rule.example[1]}</span>
                                                                    </div>
                                                                  </div>
                                                                )}
                                                              </div>
                                                            );
                                                          })}
                                                        </div>
                                                      )}
                                                    </div>
                                                  )}
                                                </div>
                                              );
                                            })}
                                          </div>
                                        </div>
                                      )}

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
                                              // Decision returned to queue — agent keeps running
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
                                          {showActivityLog ? <ChevronDown className="size-4" strokeWidth={2} /> : <ChevronRight className="size-4" strokeWidth={2} />}
                                          <span>Activity log ({activityLog.length} event{activityLog.length !== 1 ? 's' : ''})</span>
                                        </button>
                                        {showActivityLog && (
                                          <div className="space-y-2 ml-2">
                                            {activityLog.length === 0 && (
                                              <div className="text-[11px] text-foreground/40 ml-4">No events yet</div>
                                            )}
                                            {activityLog.map(entry => (
                                              <div key={entry.id} className="flex items-start gap-3 text-[11px]">
                                                <span className="text-foreground/40 shrink-0 w-12 pt-px">{formatTime(entry.time)}</span>
                                                <div className="flex items-center gap-2 flex-1">
                                                  {entry.variant === 'start' && <Play className="size-3 text-foreground/40 shrink-0" strokeWidth={2} />}
                                                  {entry.variant === 'stream' && <CheckCircle className="size-3 text-[#059669] shrink-0" strokeWidth={2} />}
                                                  {entry.variant === 'decision' && <AlertTriangle className="size-3 text-[#d97706] shrink-0" strokeWidth={2} />}
                                                  {entry.variant === 'approve' && <Check className="size-3 text-[#059669] shrink-0" strokeWidth={2} />}
                                                  {entry.variant === 'skip' && <SkipForward className="size-3 text-foreground/40 shrink-0" strokeWidth={2} />}
                                                  {entry.variant === 'block' && <Pause className="size-3 text-[#d97706] shrink-0" strokeWidth={2} />}
                                                  {entry.variant === 'resume' && <Play className="size-3 text-[#3b82f6] shrink-0" strokeWidth={2} />}
                                                  {entry.variant === 'complete' && <CheckCircle className="size-3 text-[#059669] shrink-0" strokeWidth={2} />}
                                                  {entry.variant === 'error' && <AlertTriangle className="size-3 text-[#dc2626] shrink-0" strokeWidth={2} />}
                                                  {entry.variant === 'progress' && <Activity className="size-3 text-[#3b82f6] shrink-0" strokeWidth={2} />}
                                                  <span className="text-foreground/70">{entry.text}</span>
                                                </div>
                                              </div>
                                            ))}
                                          </div>
                                        )}
                                      </div>
                                    </>
                                  )}

                                  {/* STATE 3: PAUSED FOR DECISION */}
                                  {/* STATE 3: BLOCKED — agent ran out of safe work */}
                                  {agentState === 'blocked' && !showResumeView && (
                                    <>
                                      {/* Struggling banner — shown when many decisions pile up unresolved */}
                                      {isStruggling && (
                                        <div className="p-5 border-b border-border bg-[#fef2f2]">
                                          <div className="flex items-start gap-3">
                                            <AlertTriangle className="size-4 text-[#dc2626] mt-0.5 shrink-0" strokeWidth={2} />
                                            <div>
                                              <div className="text-[13px] font-medium text-[#dc2626] mb-1">
                                                Agent is struggling to make progress
                                              </div>
                                              <p className="text-[12px] text-foreground/70 leading-relaxed">
                                                {pendingDecisions.length} decisions are unresolved and the agent is fully blocked. This volume of unresolved cases suggests an underlying data quality issue the current ruleset cannot handle — likely conflicting source systems, ambiguous identity signals, or records outside the scope of the defined rules. Consider reviewing the source data for systemic issues before continuing.
                                              </p>
                                              <div className="flex items-center gap-3 mt-3">
                                                <button
                                                  onClick={() => { setAgentState('proposed'); setStreamProgress(Object.fromEntries(STREAMS.map(s => [s.id, 0]))); setDecisions([]); }}
                                                  className="px-3 py-1.5 text-[12px] font-medium bg-white border border-[#fecaca] text-[#dc2626] rounded hover:bg-[#fee2e2]"
                                                >
                                                  Stop and review data quality
                                                </button>
                                                <span className="text-[12px] text-foreground/40">or resolve decisions below</span>
                                              </div>
                                            </div>
                                          </div>
                                        </div>
                                      )}

                                      {/* Blocked header */}
                                      <div className="p-5 border-b border-border bg-[#fffbeb]">
                                        <div className="flex items-center gap-2 mb-2">
                                          <Pause className="size-4 text-[#d97706]" strokeWidth={2} />
                                          <h3 className="text-[14px] font-medium text-foreground">
                                            Agent blocked — no safe work remaining
                                          </h3>
                                        </div>
                                        <p className="text-[12px] text-foreground/70">
                                          The agent has processed everything it can without your input. {pendingDecisions.length} decision{pendingDecisions.length > 1 ? 's' : ''} must be resolved before processing can resume. Resolve them in any order — the agent will pick up each set of records as soon as you approve.
                                        </p>
                                      </div>

                                      {/* Progress — stream breakdown frozen at block point */}
                                      <div className="p-5 border-b border-border">
                                        <div className="flex items-center justify-between mb-1.5">
                                          <span className="text-[12px] font-medium text-foreground">Overall progress</span>
                                          <span className="text-[12px] text-foreground/70">{Math.round(progress * 10) / 10}% — all streams blocked</span>
                                        </div>
                                        <div className="h-1.5 bg-[#e5e7eb] rounded-full overflow-hidden mb-4">
                                          <div className="h-full bg-[#d97706]" style={{ width: `${Math.round(progress * 10) / 10}%` }} />
                                        </div>
                                        <div className="space-y-2.5">
                                          {visibleStreams.map(stream => {
                                            const sp = Math.round(streamProgress[stream.id]);
                                            const status = getStreamStatus(stream);
                                            return (
                                              <div key={stream.id} className="flex items-center gap-2.5">
                                                <div className="w-40 shrink-0 flex items-center gap-1.5">
                                                  {status === 'completed'
                                                    ? <CheckCircle className="size-3 text-[#059669] shrink-0" strokeWidth={2} />
                                                    : <Pause className="size-3 text-[#d97706] shrink-0" strokeWidth={2} />
                                                  }
                                                  <span className={`text-[11px] font-medium truncate ${status === 'completed' ? 'text-foreground/40' : 'text-[#92400e]'}`}>
                                                    {stream.label}
                                                  </span>
                                                </div>
                                                <div className="flex-1 h-1.5 bg-[#e5e7eb] rounded-full overflow-hidden">
                                                  <div
                                                    className={`h-full ${status === 'completed' ? 'bg-[#059669]' : 'bg-[#d97706]'}`}
                                                    style={{ width: `${sp}%` }}
                                                  />
                                                </div>
                                                <span className="text-[11px] w-7 text-right shrink-0 text-foreground/40">{sp}%</span>
                                                <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium shrink-0 w-14 text-center ${status === 'completed' ? 'bg-[#d1fae5] text-[#059669]' : 'bg-[#fef3c7] text-[#d97706]'}`}>
                                                  {status === 'completed' ? 'Done' : 'Blocked'}
                                                </span>
                                              </div>
                                            );
                                          })}
                                        </div>
                                      </div>

                                      {/* Decisions — all in insertion order, pending shows action card, resolved shows outcome */}
                                      <div className="border-b border-border divide-y divide-border">
                                        <div className="px-5 py-3 bg-[#fafafa] flex items-center justify-between">
                                          <span className="text-[12px] font-medium text-foreground">{pendingDecisions.length} decision{pendingDecisions.length > 1 ? 's' : ''} required to continue</span>
                                          <span className="text-[11px] text-foreground/50">{resolvedDecisionCount > 0 ? `${resolvedDecisionCount} resolved` : 'None resolved yet'}</span>
                                        </div>
                                        {decisions.map((decision) => {
                                          if (decision.status !== 'pending') {
                                            const outcome = DECISION_OUTCOMES[decision.label];
                                            return (
                                              <div key={`resolved-blocked-${decision.id}`} className="bg-[#fafafa]">
                                                <div className="px-5 py-4">
                                                  <div className="flex items-center justify-between mb-2.5">
                                                    <div className="flex items-center gap-2 min-w-0">
                                                      {decision.status === 'approved'
                                                        ? <CheckCircle className="size-4 text-[#059669] shrink-0" strokeWidth={2} />
                                                        : <SkipForward className="size-4 text-foreground/40 shrink-0" strokeWidth={2} />
                                                      }
                                                      <span className="text-[13px] font-medium text-foreground/80 truncate">{decision.label}</span>
                                                    </div>
                                                    <div className="flex items-center gap-2 shrink-0 ml-4">
                                                      <span className={`px-2 py-0.5 rounded text-[11px] font-medium ${decision.status === 'approved' ? 'bg-[#d1fae5] text-[#059669]' : 'bg-[#f3f4f6] text-foreground/50'}`}>
                                                        {decision.status === 'approved' ? 'Applied' : 'Skipped'}
                                                      </span>
                                                      {decision.resolvedAt && <span className="text-[11px] text-foreground/40">{formatTime(decision.resolvedAt)}</span>}
                                                    </div>
                                                  </div>
                                                  {decision.status === 'approved' && outcome && (
                                                    <div className="ml-6 space-y-2">
                                                      <div className="text-[12px] text-foreground/60 font-medium">{outcome.headline}</div>
                                                      {outcome.lines.map((line, li) => (
                                                        <div key={li} className="flex items-start gap-2 text-[11px]">
                                                          {line.variant === 'applied' && <CheckCircle className="size-3 text-[#059669] mt-0.5 shrink-0" strokeWidth={2} />}
                                                          {line.variant === 'flagged' && <AlertTriangle className="size-3 text-[#d97706] mt-0.5 shrink-0" strokeWidth={2} />}
                                                          {line.variant === 'escalated' && <Shield className="size-3 text-[#7c3aed] mt-0.5 shrink-0" strokeWidth={2} />}
                                                          <span className="text-foreground/60">{line.text}</span>
                                                        </div>
                                                      ))}
                                                    </div>
                                                  )}
                                                </div>
                                              </div>
                                            );
                                          }
                                          /* pending decision card below */
                                          const subPatterns = DECISION_SUB_PATTERNS[decision.label];
                                          const isDetailOpen = expandedDecisionDetails.has(decision.id);
                                          const isMinors = decision.label === 'Minors with incomplete consent records';
                                          const enabledCount = subPatterns ? subPatterns.filter((_, i) => !disabledSubPatterns.has(`${decision.id}-${i}`)).length : null;
                                          const approveLabel = isMinors
                                            ? 'Escalate to review'
                                            : (enabledCount !== null && enabledCount < subPatterns!.length)
                                              ? `Approve (${enabledCount} of ${subPatterns!.length})`
                                              : 'Approve';
                                          return (
                                            <div key={decision.id} className="bg-background">
                                              {/* Decision header */}
                                              <div className="px-5 py-4 flex items-start justify-between gap-4">
                                                <div className="flex items-start gap-3 min-w-0">
                                                  <div className="size-2 rounded-full bg-[#d97706] mt-1.5 shrink-0" />
                                                  <div className="min-w-0">
                                                    <div className="text-[13px] font-medium text-foreground">{decision.label}</div>
                                                    <div className="text-[11px] text-foreground/50 mt-0.5">{decision.records.toLocaleString()} records blocked · queued {getTimeSince(decision.pausedAt)}</div>
                                                  </div>
                                                </div>
                                                <div className="flex items-center gap-2 shrink-0">
                                                  <button
                                                    onClick={() => setDecisions(prev => prev.map(d =>
                                                      d.id === decision.id ? { ...d, status: 'skipped', resolvedAt: new Date() } : d
                                                    ))}
                                                    className="px-3 py-1.5 text-[12px] text-foreground/60 hover:text-foreground font-medium border border-border rounded hover:bg-accent"
                                                  >
                                                    Skip
                                                  </button>
                                                  <button
                                                    onClick={() => {
                                                      setDecisions(prev => prev.map(d =>
                                                        d.id === decision.id ? { ...d, status: 'approved', resolvedAt: new Date() } : d
                                                      ));
                                                      setUndoCountdown(30);
                                                    }}
                                                    className="px-4 py-1.5 text-[12px] font-medium text-white rounded whitespace-nowrap"
                                                    style={{ background: isMinors ? 'linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)' : 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)' }}
                                                  >
                                                    <div className="flex items-center gap-1.5">
                                                      <Check className="size-3.5" strokeWidth={2.5} />
                                                      <span>{approveLabel}</span>
                                                    </div>
                                                  </button>
                                                </div>
                                              </div>
                                              {/* Sub-patterns section — collapsed by default */}
                                              {subPatterns && (
                                                <div className="px-5 pb-4">
                                                  <button
                                                    onClick={() => toggleDecisionDetail(decision.id)}
                                                    className="flex items-center gap-1.5 text-[11px] text-foreground/60 hover:text-foreground mb-2"
                                                  >
                                                    {isDetailOpen ? <ChevronDown className="size-3" strokeWidth={2} /> : <ChevronRight className="size-3" strokeWidth={2} />}
                                                    <span>{decision.records.toLocaleString()} records across {subPatterns.length} sub-patterns — expand to review before approving</span>
                                                  </button>
                                                  {isDetailOpen && (
                                                    <div className="border border-border rounded-lg overflow-hidden divide-y divide-border">
                                                      {subPatterns.map((rule, i) => {
                                                        const ruleKey = `${decision.id}-${i}`;
                                                        const isRuleOpen = expandedRules.has(i) && decision.label === 'Conflicting identity — no shared key';
                                                        const isDisabled = disabledSubPatterns.has(ruleKey);
                                                        return (
                                                          <div key={i} className={`${isRuleOpen ? 'bg-[#fafafa]' : 'bg-background hover:bg-[#fafafa]'} ${isDisabled ? 'opacity-40' : ''}`}>
                                                            <div className="flex items-center">
                                                              <button
                                                                onClick={() => toggleSubPattern(ruleKey)}
                                                                className="px-3 py-3 shrink-0 flex items-center justify-center border-r border-border hover:bg-accent"
                                                                title={isDisabled ? 'Enable sub-pattern' : 'Disable sub-pattern'}
                                                              >
                                                                <div className={`size-3.5 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${isDisabled ? 'border-foreground/20 bg-transparent' : 'border-[#3b82f6] bg-[#3b82f6]'}`}>
                                                                  {!isDisabled && <Check className="size-2.5 text-white" strokeWidth={3} />}
                                                                </div>
                                                              </button>
                                                              <button
                                                                onClick={() => {
                                                                  if (decision.label === 'Conflicting identity — no shared key') {
                                                                    setExpandedRules(prev => { const next = new Set(prev); next.has(i) ? next.delete(i) : next.add(i); return next; });
                                                                  }
                                                                }}
                                                                className="flex-1 px-4 py-3 flex items-center gap-3 text-left"
                                                              >
                                                                {decision.label === 'Conflicting identity — no shared key'
                                                                  ? (isRuleOpen ? <ChevronDown className="size-3.5 text-foreground/40 shrink-0" strokeWidth={2} /> : <ChevronRight className="size-3.5 text-foreground/40 shrink-0" strokeWidth={2} />)
                                                                  : <div className="size-3.5 shrink-0" />
                                                                }
                                                                <div className="flex-1 min-w-0">
                                                                  <div className="flex items-center gap-2 flex-wrap">
                                                                    <span className="text-[12px] font-medium text-foreground">{rule.signal}</span>
                                                                    <span className={`px-1.5 py-0.5 ${rule.confidenceBg} ${rule.confidenceColor} text-[10px] font-medium rounded`}>{rule.confidenceLabel}</span>
                                                                  </div>
                                                                  <div className="text-[11px] text-foreground/50 mt-0.5">{rule.action}</div>
                                                                </div>
                                                                <span className="text-[11px] text-foreground/40 shrink-0 mr-3">{rule.records.toLocaleString()} records</span>
                                                              </button>
                                                              <div className="px-3 shrink-0 border-l border-border">
                                                                <button className="text-[11px] text-[#3b82f6] hover:text-[#2563eb] font-medium whitespace-nowrap py-3">Modify →</button>
                                                              </div>
                                                            </div>
                                                            {isRuleOpen && (
                                                              <div className="px-4 pb-4 pt-1 ml-6 space-y-3">
                                                                <p className="text-[12px] text-foreground/70 leading-relaxed">{rule.detail}</p>
                                                                <div className="flex items-center gap-2 text-[11px]">
                                                                  <span className="text-foreground/50">Example:</span>
                                                                  <span className="px-2 py-0.5 bg-[#fef2f2] border border-[#fecaca] rounded font-mono text-[#dc2626]">{rule.example[0]}</span>
                                                                  <span className="text-foreground/40">→</span>
                                                                  <span className="px-2 py-0.5 bg-[#f0fdf4] border border-[#bbf7d0] rounded font-mono text-[#059669]">{rule.example[1]}</span>
                                                                </div>
                                                              </div>
                                                            )}
                                                          </div>
                                                        );
                                                      })}
                                                    </div>
                                                  )}
                                                </div>
                                              )}
                                            </div>
                                          );
                                        })}
                                      </div>


                                      {/* Resume CTA — shown once all decisions are resolved */}
                                      {pendingDecisions.length === 0 && decisions.length > 0 && (
                                        <div className="p-5 border-b border-border bg-[#f0fdf4]">
                                          <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2 text-[12px] text-[#059669]">
                                              <CheckCircle className="size-4" strokeWidth={2} />
                                              <span>All decisions resolved — ready to resume</span>
                                            </div>
                                            <button
                                              onClick={() => setAgentState('running')}
                                              className="px-4 py-2 text-white rounded text-[13px] font-medium"
                                              style={{ background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)' }}
                                            >
                                              <div className="flex items-center gap-2">
                                                <Play className="size-4" strokeWidth={2} />
                                                <span>Resume processing</span>
                                              </div>
                                            </button>
                                          </div>
                                        </div>
                                      )}

                                      {/* Activity log */}
                                      <div className="p-5">
                                        <button
                                          onClick={() => setShowActivityLog(!showActivityLog)}
                                          className="flex items-center gap-2 text-[13px] font-medium text-foreground mb-3 hover:text-foreground/80"
                                        >
                                          {showActivityLog ? <ChevronDown className="size-4" strokeWidth={2} /> : <ChevronRight className="size-4" strokeWidth={2} />}
                                          <span>Activity log ({activityLog.length} event{activityLog.length !== 1 ? 's' : ''})</span>
                                        </button>
                                        {showActivityLog && (
                                          <div className="space-y-2 ml-2">
                                            {activityLog.length === 0 && (
                                              <div className="text-[11px] text-foreground/40 ml-4">No events yet</div>
                                            )}
                                            {activityLog.map(entry => (
                                              <div key={entry.id} className="flex items-start gap-3 text-[11px]">
                                                <span className="text-foreground/40 shrink-0 w-12 pt-px">{formatTime(entry.time)}</span>
                                                <div className="flex items-center gap-2 flex-1">
                                                  {entry.variant === 'start' && <Play className="size-3 text-foreground/40 shrink-0" strokeWidth={2} />}
                                                  {entry.variant === 'stream' && <CheckCircle className="size-3 text-[#059669] shrink-0" strokeWidth={2} />}
                                                  {entry.variant === 'decision' && <AlertTriangle className="size-3 text-[#d97706] shrink-0" strokeWidth={2} />}
                                                  {entry.variant === 'approve' && <Check className="size-3 text-[#059669] shrink-0" strokeWidth={2} />}
                                                  {entry.variant === 'skip' && <SkipForward className="size-3 text-foreground/40 shrink-0" strokeWidth={2} />}
                                                  {entry.variant === 'block' && <Pause className="size-3 text-[#d97706] shrink-0" strokeWidth={2} />}
                                                  {entry.variant === 'resume' && <Play className="size-3 text-[#3b82f6] shrink-0" strokeWidth={2} />}
                                                  {entry.variant === 'complete' && <CheckCircle className="size-3 text-[#059669] shrink-0" strokeWidth={2} />}
                                                  {entry.variant === 'error' && <AlertTriangle className="size-3 text-[#dc2626] shrink-0" strokeWidth={2} />}
                                                  {entry.variant === 'progress' && <Activity className="size-3 text-[#3b82f6] shrink-0" strokeWidth={2} />}
                                                  <span className="text-foreground/70">{entry.text}</span>
                                                </div>
                                              </div>
                                            ))}
                                          </div>
                                        )}
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
                                              setStreamProgress(Object.fromEntries(STREAMS.map(s => [s.id, 0])));
                                              setDecisions([]);
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
                                      <div className="p-5 border-b border-border" data-tour-anchor="tour-completion-summary">
                                        <h3 className="text-[13px] font-medium text-foreground mb-3">
                                          What happened in this run
                                        </h3>
                                        {/* Records processed this run */}
                                        <div className="mb-4">
                                          <div className="text-[11px] text-foreground/50 uppercase tracking-wide mb-2">Processed this run · 468,160 records</div>
                                          <div className="space-y-2">
                                            <div className="flex items-center justify-between text-[12px]">
                                              <div className="flex items-center gap-2">
                                                <Check className="size-3 text-[#059669]" strokeWidth={2} />
                                                <span className="text-foreground/80">Low-risk cleanup — auto-resolved</span>
                                              </div>
                                              <div className="flex items-center gap-2">
                                                <span className="text-foreground font-medium">456,000</span>
                                                <span className="px-1.5 py-0.5 bg-[#d1fae5] text-[#059669] text-[10px] font-medium rounded">Applied</span>
                                              </div>
                                            </div>
                                            <div className="flex items-center justify-between text-[12px]">
                                              <div className="flex items-center gap-2">
                                                <Check className="size-3 text-[#059669]" strokeWidth={2} />
                                                <span className="text-foreground/80">Identity conflicts — resolved after your approval</span>
                                              </div>
                                              <div className="flex items-center gap-2">
                                                <span className="text-foreground font-medium">8,240</span>
                                                <span className="px-1.5 py-0.5 bg-[#d1fae5] text-[#059669] text-[10px] font-medium rounded">Applied</span>
                                              </div>
                                            </div>
                                            <div className="flex items-center justify-between text-[12px]">
                                              <div className="flex items-center gap-2">
                                                <Check className="size-3 text-[#059669]" strokeWidth={2} />
                                                <span className="text-foreground/80">Travel document nationality — resolved after your approval</span>
                                              </div>
                                              <div className="flex items-center gap-2">
                                                <span className="text-foreground font-medium">3,400</span>
                                                <span className="px-1.5 py-0.5 bg-[#d1fae5] text-[#059669] text-[10px] font-medium rounded">Applied</span>
                                              </div>
                                            </div>
                                            <div className="flex items-center justify-between text-[12px]">
                                              <div className="flex items-center gap-2">
                                                <AlertTriangle className="size-3 text-[#d97706]" strokeWidth={2} />
                                                <span className="text-foreground/80">Minors with incomplete consent — escalated, not modified</span>
                                              </div>
                                              <div className="flex items-center gap-2">
                                                <span className="text-foreground font-medium">520</span>
                                                <span className="px-1.5 py-0.5 bg-[#fef3c7] text-[#d97706] text-[10px] font-medium rounded">Pending review</span>
                                              </div>
                                            </div>
                                            {/* Flagged sub-patterns from approvals */}
                                            <div className="flex items-center justify-between text-[12px]">
                                              <div className="flex items-center gap-2">
                                                <AlertTriangle className="size-3 text-[#d97706]" strokeWidth={2} />
                                                <span className="text-foreground/80">Sub-patterns with insufficient confidence — queued for review</span>
                                              </div>
                                              <div className="flex items-center gap-2">
                                                <span className="text-foreground font-medium">5,400</span>
                                                <span className="px-1.5 py-0.5 bg-[#fef3c7] text-[#d97706] text-[10px] font-medium rounded">Pending review</span>
                                              </div>
                                            </div>
                                          </div>
                                        </div>

                                        {/* Records out of scope */}
                                        <div className="pt-3 border-t border-border">
                                          <div className="text-[11px] text-foreground/50 uppercase tracking-wide mb-2">Not in scope for this run · 731,840 records</div>
                                          <div className="space-y-1.5">
                                            <div className="flex items-center justify-between text-[12px]">
                                              <div className="flex items-center gap-2">
                                                <div className="size-3 rounded-full bg-foreground/20 shrink-0" />
                                                <span className="text-foreground/60">Booking records — separate remediation run required</span>
                                              </div>
                                              <span className="text-foreground/50">~412,000</span>
                                            </div>
                                            <div className="flex items-center justify-between text-[12px]">
                                              <div className="flex items-center gap-2">
                                                <div className="size-3 rounded-full bg-foreground/20 shrink-0" />
                                                <span className="text-foreground/60">Cargo &amp; freight records — different schema, not assessed</span>
                                              </div>
                                              <span className="text-foreground/50">~198,000</span>
                                            </div>
                                            <div className="flex items-center justify-between text-[12px]">
                                              <div className="flex items-center gap-2">
                                                <div className="size-3 rounded-full bg-foreground/20 shrink-0" />
                                                <span className="text-foreground/60">Crew &amp; staff records — excluded from this ruleset</span>
                                              </div>
                                              <span className="text-foreground/50">~121,840</span>
                                            </div>
                                          </div>
                                        </div>
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
                                          <span>Activity log ({activityLog.length} event{activityLog.length !== 1 ? 's' : ''})</span>
                                        </button>
                                        {showActivityLog ? (
                                          <div className="space-y-2 ml-2">
                                            {activityLog.length === 0 && (
                                              <div className="text-[11px] text-foreground/40 ml-4">No events yet</div>
                                            )}
                                            {activityLog.map(entry => (
                                              <div key={entry.id} className="flex items-start gap-3 text-[11px]">
                                                <span className="text-foreground/40 shrink-0 w-12 pt-px">{formatTime(entry.time)}</span>
                                                <div className="flex items-center gap-2 flex-1">
                                                  {entry.variant === 'start' && <Play className="size-3 text-foreground/40 shrink-0" strokeWidth={2} />}
                                                  {entry.variant === 'stream' && <CheckCircle className="size-3 text-[#059669] shrink-0" strokeWidth={2} />}
                                                  {entry.variant === 'decision' && <AlertTriangle className="size-3 text-[#d97706] shrink-0" strokeWidth={2} />}
                                                  {entry.variant === 'approve' && <Check className="size-3 text-[#059669] shrink-0" strokeWidth={2} />}
                                                  {entry.variant === 'skip' && <SkipForward className="size-3 text-foreground/40 shrink-0" strokeWidth={2} />}
                                                  {entry.variant === 'block' && <Pause className="size-3 text-[#d97706] shrink-0" strokeWidth={2} />}
                                                  {entry.variant === 'resume' && <Play className="size-3 text-[#3b82f6] shrink-0" strokeWidth={2} />}
                                                  {entry.variant === 'complete' && <CheckCircle className="size-3 text-[#059669] shrink-0" strokeWidth={2} />}
                                                  {entry.variant === 'error' && <AlertTriangle className="size-3 text-[#dc2626] shrink-0" strokeWidth={2} />}
                                                  {entry.variant === 'progress' && <Activity className="size-3 text-[#3b82f6] shrink-0" strokeWidth={2} />}
                                                  <span className="text-foreground/70">{entry.text}</span>
                                                </div>
                                              </div>
                                            ))}
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

                                      {/* Post-completion actions */}
                                      <div className="p-5">
                                        <div className="text-[11px] text-foreground/50 uppercase tracking-wide mb-3">What would you like to do next?</div>
                                        <div className="space-y-2">
                                          {/* Review pending cases — most urgent */}
                                          <button
                                            onClick={() => setShowSampleModal(true)}
                                            className="w-full flex items-center justify-between px-4 py-3 rounded border border-[#d97706]/40 bg-[#fffbeb] hover:bg-[#fef3c7] transition-colors text-left group"
                                          >
                                            <div className="flex items-center gap-3">
                                              <div className="size-7 rounded bg-[#d97706]/10 flex items-center justify-center shrink-0">
                                                <AlertTriangle className="size-3.5 text-[#d97706]" strokeWidth={2} />
                                              </div>
                                              <div>
                                                <div className="text-[13px] font-medium text-foreground">Review pending cases</div>
                                                <div className="text-[11px] text-foreground/60">5,920 records need a human decision before changes can be applied</div>
                                              </div>
                                            </div>
                                            <ChevronRight className="size-4 text-foreground/30 group-hover:text-foreground/60 transition-colors shrink-0" strokeWidth={2} />
                                          </button>

                                          {/* Download full change report */}
                                          <button
                                            onClick={() => setShowSampleModal(true)}
                                            className="w-full flex items-center justify-between px-4 py-3 rounded border border-border hover:bg-muted/50 transition-colors text-left group"
                                          >
                                            <div className="flex items-center gap-3">
                                              <div className="size-7 rounded bg-muted flex items-center justify-center shrink-0">
                                                <FileText className="size-3.5 text-foreground/60" strokeWidth={2} />
                                              </div>
                                              <div>
                                                <div className="text-[13px] font-medium text-foreground">Download change report</div>
                                                <div className="text-[11px] text-foreground/60">Full audit trail — every change with timestamp, confidence score, and rule applied</div>
                                              </div>
                                            </div>
                                            <ChevronRight className="size-4 text-foreground/30 group-hover:text-foreground/60 transition-colors shrink-0" strokeWidth={2} />
                                          </button>

                                          {/* View cleaned dataset */}
                                          <button
                                            onClick={() => setShowSampleModal(true)}
                                            className="w-full flex items-center justify-between px-4 py-3 rounded border border-border hover:bg-muted/50 transition-colors text-left group"
                                          >
                                            <div className="flex items-center gap-3">
                                              <div className="size-7 rounded bg-muted flex items-center justify-center shrink-0">
                                                <Database className="size-3.5 text-foreground/60" strokeWidth={2} />
                                              </div>
                                              <div>
                                                <div className="text-[13px] font-medium text-foreground">View dataset</div>
                                                <div className="text-[11px] text-foreground/60">Browse the passenger master record with changes applied and diffs highlighted</div>
                                              </div>
                                            </div>
                                            <ChevronRight className="size-4 text-foreground/30 group-hover:text-foreground/60 transition-colors shrink-0" strokeWidth={2} />
                                          </button>
                                        </div>
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