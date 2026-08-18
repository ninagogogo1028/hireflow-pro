import React, { useState, useMemo, useRef, useEffect } from 'react';
import { 
  Briefcase, 
  Users, 
  Database, 
  Plus, 
  Search, 
  Filter, 
  Star, 
  ChevronRight, 
  MessageSquare,
  FileText,
  TrendingUp,
  Layout,
  CheckCircle,
  XCircle,
  Clock,
  Upload,
  Download,
  Paperclip,
  X,
  Loader2,
  BarChart3,
  Calendar,
  ExternalLink,
  PlusCircle,
  SearchCode,
  Tags,
  GraduationCap,
  UserCheck,
  BrainCircuit,
  Lightbulb,
  AlertCircle,
  CircleDashed,
  ArrowRight,
  MoveRight,
  Archive,
  Power,
  RotateCcw,
  Trash2,
  PlayCircle,
  UserPlus,
  ChevronDown,
  Edit3,
  Type as TypeIcon,
  List,
  Menu,
  UserSearch,
  School,
  FileUp,
  FileArchive,
  Eye,
  Settings2,
  Pencil,
  Sparkles,
  Zap,
  FastForward,
  UserMinus,
  BarChart,
  Target
} from 'lucide-react';
import { JobDemand, Candidate, CandidateStatus, JobType, StageStatus, CandidateNote } from './types';
import { INITIAL_JOBS, INITIAL_CANDIDATES, STATUS_LABELS } from './constants';
import { analyzeJD, JDAnalysis, matchTalentToJob, TalentMatchResult, parseResumeData, isSupportedResumeType, MAX_RESUME_FILE_BYTES } from './aiService';

const App: React.FC = () => {
  // Initialize state from localStorage if available, otherwise use defaults
  const [jobs, setJobs] = useState<JobDemand[]>(() => {
    const saved = localStorage.getItem('hireflow_jobs');
    return saved ? JSON.parse(saved) : INITIAL_JOBS;
  });
  const [candidates, setCandidates] = useState<Candidate[]>(() => {
    const saved = localStorage.getItem('hireflow_candidates');
    return saved ? JSON.parse(saved) : INITIAL_CANDIDATES;
  });

  // Persist data whenever it changes
  useEffect(() => {
    localStorage.setItem('hireflow_jobs', JSON.stringify(jobs));
  }, [jobs]);

  useEffect(() => {
    localStorage.setItem('hireflow_candidates', JSON.stringify(candidates));
  }, [candidates]);

  const [activeTab, setActiveTab] = useState<'jobs' | 'pipeline' | 'talent-pool' | 'dashboard'>('dashboard');
  const [selectedJobId, setSelectedJobId] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  
  // Talent Pool Search Term
  const [talentPoolSearchTerm, setTalentPoolSearchTerm] = useState('');

  // Job Filtering States
  const [jobStatusFilter, setJobStatusFilter] = useState<'OPEN' | 'CLOSED'>('OPEN');

  // Department Management
  const [departments, setDepartments] = useState<string[]>(['研发部', '产品部', '市场部', '人事部', '运营部']);
  const [isDeptDropdownOpen, setIsDeptDropdownOpen] = useState(false);
  const [manualDeptInput, setManualDeptInput] = useState(false);
  const deptDropdownRef = useRef<HTMLDivElement>(null);

  // Modals & Detail Views
  const [isAddingJob, setIsAddingJob] = useState(false);
  const [isAddingCandidate, setIsAddingCandidate] = useState(false);
  const [isParsingResume, setIsParsingResume] = useState(false);
  const [editingCandidateId, setEditingCandidateId] = useState<string | null>(null);
  const [viewingJobDetailId, setViewingJobDetailId] = useState<string | null>(null);
  const [assigningCandidateId, setAssigningCandidateId] = useState<string | null>(null);
  
  // AI Matching States
  const [isMatchingModalOpen, setIsMatchingModalOpen] = useState(false);
  const [matchingJobId, setMatchingJobId] = useState<string>('');
  const [matchingResults, setMatchingResults] = useState<TalentMatchResult[]>([]);
  const [isMatchingLoading, setIsMatchingLoading] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Remarks/Notes States for Kanban
  const [editingNotesId, setEditingNotesId] = useState<string | null>(null);
  const [tempNotes, setTempNotes] = useState('');

  // Form States
  const [jobForm, setJobForm] = useState<{ title: string; department: string; description: string; type: JobType }>({ 
    title: '', 
    department: '研发部', 
    description: '',
    type: 'FULL_TIME'
  });

  const [candidateForm, setCandidateForm] = useState<{
    name: string;
    jobId: string;
    source: string;
    contactInfo: string;
    notes: string;
    isPoolDirect: boolean;
    resumeFile: File | null;
  }>({
    name: '',
    jobId: '',
    source: 'BOSS直聘',
    contactInfo: '',
    notes: '',
    isPoolDirect: false,
    resumeFile: null
  });

  // Handle outside click for custom dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (deptDropdownRef.current && !deptDropdownRef.current.contains(event.target as Node)) {
        setIsDeptDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Stats Logic for Dashboard Template
  const stats = useMemo(() => {
    const total = candidates.length;
    const hired = candidates.filter(c => c.status === CandidateStatus.HIRED).length;
    const backup = candidates.filter(c => c.status === CandidateStatus.BACKUP).length;
    const pipeline = candidates.filter(c => ![CandidateStatus.HIRED, CandidateStatus.REJECTED, CandidateStatus.BACKUP].includes(c.status)).length;
    
    // Calculate Source Transformation Ranking
    const sourceCounts: Record<string, number> = {};
    candidates.forEach(c => {
      sourceCounts[c.source] = (sourceCounts[c.source] || 0) + 1;
    });
    const ranking = Object.entries(sourceCounts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);

    return { total, hired, backup, pipeline, ranking };
  }, [candidates]);

  // Updated kanban stages: removed CONTACTED
  const kanbanStages: CandidateStatus[] = [
    CandidateStatus.NEW,
    CandidateStatus.LM_REVIEW,
    CandidateStatus.LM_APPROVED,
    CandidateStatus.INTERVIEW_1,
    CandidateStatus.INTERVIEW_2,
    CandidateStatus.INTERVIEW_3,
    CandidateStatus.OFFER,
  ];

  const handleUpdateStatus = (candidateId: string, newStatus: CandidateStatus) => {
    setCandidates(prev => prev.map(c => c.id === candidateId ? { ...c, status: newStatus, stageStatus: 'PENDING' } : c));
  };

  const handleUpdateStageStatus = (candidateId: string, newStageStatus: StageStatus) => {
    setCandidates(prev => prev.map(c => c.id === candidateId ? { ...c, stageStatus: newStageStatus } : c));
  };

  const handleAdvanceStage = (candidate: Candidate) => {
    const currentIndex = kanbanStages.indexOf(candidate.status);
    if (currentIndex < kanbanStages.length - 1) {
      handleUpdateStatus(candidate.id, kanbanStages[currentIndex + 1]);
    } else if (candidate.status === CandidateStatus.OFFER) {
      handleUpdateStatus(candidate.id, CandidateStatus.HIRED);
    }
  };

  const handleJumpToOffer = (candidateId: string) => {
    if (window.confirm("确定跳过后续面试，直接将候选人推进至入职确认阶段吗？")) {
      handleUpdateStatus(candidateId, CandidateStatus.OFFER);
    }
  };

  const handleToggleHighPotential = (candidateId: string) => {
    setCandidates(prev => prev.map(c => c.id === candidateId ? { ...c, isHighPotential: !c.isHighPotential } : c));
  };

  const handleMoveToBackup = (candidateId: string) => {
    setCandidates(prev => prev.map(c => c.id === candidateId ? { ...c, status: CandidateStatus.BACKUP, stageStatus: 'PENDING' } : c));
  };

  const handlePermanentDelete = (candidateId: string) => {
    if (window.confirm("确定要永久删除该人才吗？此操作不可撤销。")) {
      setCandidates(prev => prev.filter(c => c.id !== candidateId));
    }
  };

  const handleSaveNotes = (id: string) => {
    if (!tempNotes.trim()) {
      setEditingNotesId(null);
      return;
    }
    
    const now = new Date();
    const timestamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    
    const newNote: CandidateNote = {
      id: `n-${Date.now()}`,
      text: tempNotes,
      timestamp
    };

    setCandidates(prev => prev.map(c => c.id === id ? { ...c, notes: [newNote, ...c.notes] } : c));
    setEditingNotesId(null);
    setTempNotes('');
  };

  const handleAssignToJob = (candidateId: string, jobId: string) => {
    setCandidates(prev => prev.map(c => c.id === candidateId ? { 
      ...c, 
      jobId, 
      status: CandidateStatus.NEW, 
      stageStatus: 'PENDING' 
    } : c));
    setAssigningCandidateId(null);
    if (activeTab === 'talent-pool') {
      setActiveTab('pipeline');
      setSelectedJobId(jobId);
    }
  };

  const handleToggleJobStatus = (jobId: string) => {
    setJobs(prev => prev.map(j => {
      if (j.id === jobId) {
        return { ...j, status: j.status === 'OPEN' ? 'CLOSED' : 'OPEN' };
      }
      return j;
    }));
  };

  const handleDeleteJob = (jobId: string) => {
    if (window.confirm('确定要删除该职位吗？这可能会影响到该职位下的候选人显示。')) {
      setJobs(prev => prev.filter(j => j.id !== jobId));
      if (selectedJobId === jobId) setSelectedJobId('all');
      if (viewingJobDetailId === jobId) setViewingJobDetailId(null);
    }
  };

  const filteredCandidates = useMemo(() => {
    let result = candidates;
    if (searchTerm) {
      const lowTerm = searchTerm.toLowerCase();
      result = result.filter(c => {
        const job = jobs.find(j => j.id === c.jobId);
        return (
          c.name.toLowerCase().includes(lowTerm) ||
          c.source.toLowerCase().includes(lowTerm) ||
          c.notes.some(n => n.text.toLowerCase().includes(lowTerm)) ||
          (job && job.title.toLowerCase().includes(lowTerm)) ||
          (job && job.department.toLowerCase().includes(lowTerm))
        );
      });
    }
    if (activeTab === 'pipeline' && selectedJobId !== 'all') {
      result = result.filter(c => c.jobId === selectedJobId);
    }
    return result;
  }, [candidates, selectedJobId, searchTerm, activeTab, jobs]);

  const talentPoolGroups = useMemo(() => {
    const backups = candidates.filter(c => c.status === CandidateStatus.BACKUP);
    
    // Apply Talent Pool specific search
    let filteredBackups = backups;
    if (talentPoolSearchTerm) {
      const lowTerm = talentPoolSearchTerm.toLowerCase();
      filteredBackups = backups.filter(c => 
        c.name.toLowerCase().includes(lowTerm) ||
        c.notes.some(n => n.text.toLowerCase().includes(lowTerm)) ||
        c.source.toLowerCase().includes(lowTerm) ||
        c.contactInfo.toLowerCase().includes(lowTerm)
      );
    }

    const groups: Record<string, Candidate[]> = {};
    filteredBackups.forEach(c => {
      const job = jobs.find(j => j.id === c.jobId);
      const dept = job ? job.department : '储备池 (未分配)';
      if (!groups[dept]) groups[dept] = [];
      groups[dept].push(c);
    });
    return groups;
  }, [candidates, jobs, talentPoolSearchTerm]);

  const filteredJobsByStatus = useMemo(() => {
    return jobs.filter(j => j.status === jobStatusFilter);
  }, [jobs, jobStatusFilter]);

  const fullTimeJobs = useMemo(() => filteredJobsByStatus.filter(j => j.type === 'FULL_TIME'), [filteredJobsByStatus]);
  const internJobs = useMemo(() => filteredJobsByStatus.filter(j => j.type === 'INTERN'), [filteredJobsByStatus]);

  const handleDeleteDepartment = (e: React.MouseEvent, deptToDelete: string) => {
    e.stopPropagation(); 
    if (departments.length <= 1) {
      alert('至少需要保留一个部门');
      return;
    }
    if (window.confirm(`确定要彻底删除“${deptToDelete}”部门吗？`)) {
      const updatedDepts = departments.filter(d => d !== deptToDelete);
      setDepartments(updatedDepts);
      if (jobForm.department === deptToDelete) {
        setJobForm({ ...jobForm, department: updatedDepts[0] });
      }
    }
  };

  const handleStartEditCandidate = (candidate: Candidate) => {
    setEditingCandidateId(candidate.id);
    setCandidateForm({
      name: candidate.name,
      jobId: candidate.jobId || '',
      source: candidate.source,
      contactInfo: candidate.contactInfo,
      notes: '', // New input is empty
      isPoolDirect: !candidate.jobId,
      resumeFile: null
    });
    setIsAddingCandidate(true);
  };

  const handleAddOrUpdateCandidate = () => {
    if (!candidateForm.name) return;
    
    const isEditing = !!editingCandidateId;
    let resumeUrl = isEditing ? candidates.find(c => c.id === editingCandidateId)?.resumeUrl : undefined;
    let resumeFileName = isEditing ? candidates.find(c => c.id === editingCandidateId)?.resumeFileName : undefined;

    if (candidateForm.resumeFile) {
      resumeUrl = URL.createObjectURL(candidateForm.resumeFile);
      resumeFileName = candidateForm.resumeFile.name;
    }

    const now = new Date();
    const timestamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    
    const newNote: CandidateNote | null = candidateForm.notes ? {
      id: `n-${Date.now()}`,
      text: candidateForm.notes,
      timestamp
    } : null;

    if (isEditing) {
      setCandidates(prev => prev.map(c => c.id === editingCandidateId ? {
        ...c,
        name: candidateForm.name,
        jobId: candidateForm.isPoolDirect ? undefined : candidateForm.jobId,
        source: candidateForm.source,
        contactInfo: candidateForm.contactInfo,
        notes: newNote ? [newNote, ...c.notes] : c.notes,
        resumeUrl: resumeUrl,
        resumeFileName: resumeFileName,
        status: (c.status === CandidateStatus.BACKUP && !candidateForm.isPoolDirect) ? CandidateStatus.NEW : c.status
      } : c));
    } else {
      const newCandidate: Candidate = {
        id: `c-${Date.now()}`,
        name: candidateForm.name,
        jobId: candidateForm.isPoolDirect ? undefined : candidateForm.jobId,
        source: candidateForm.source,
        status: candidateForm.isPoolDirect ? CandidateStatus.BACKUP : CandidateStatus.NEW,
        stageStatus: 'PENDING',
        isHighPotential: false,
        contactInfo: candidateForm.contactInfo,
        interviews: [],
        notes: newNote ? [newNote] : [],
        resumeUrl: resumeUrl,
        resumeFileName: resumeFileName
      };
      setCandidates([...candidates, newCandidate]);
    }
    
    setIsAddingCandidate(false);
    setEditingCandidateId(null);
    setCandidateForm({ name: '', jobId: '', source: 'BOSS直聘', contactInfo: '', notes: '', isPoolDirect: false, resumeFile: null });
  };

  const handlePublishJob = () => {
    if (!jobForm.title || !jobForm.department) {
      alert('请完整填写职位名称和部门');
      return;
    }
    
    // Feature: Permanently store manually added department
    if (manualDeptInput && !departments.includes(jobForm.department)) {
      setDepartments(prev => [...prev, jobForm.department]);
    }

    const newJob: JobDemand = { 
      ...jobForm, 
      id: `job-${Date.now()}`, 
      platforms: [], 
      createDate: new Date().toISOString().split('T')[0], 
      status: 'OPEN' 
    };
    setJobs([...jobs, newJob]);
    setIsAddingJob(false);
    setManualDeptInput(false);
    setIsDeptDropdownOpen(false);
    setJobForm({ title: '', department: '研发部', description: '', type: 'FULL_TIME' });
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setCandidateForm(prev => ({ ...prev, resumeFile: file }));

      // Attaching a resume and auto-filling from it are separate concerns. A file
      // that cannot be parsed is still kept as an attachment; only the auto-fill
      // step is skipped.

      // Checked against the same list the proxy enforces, so an unsupported type
      // is skipped locally instead of being uploaded and refused with a 415.
      if (!isSupportedResumeType(file.type)) return;

      // Checked before reading the file: an oversized upload would otherwise be
      // base64-encoded and sent in full only to be rejected server-side. Unlike
      // an unsupported type, this limit is invisible to the user, so say so.
      if (file.size > MAX_RESUME_FILE_BYTES) {
        alert(`简历文件超过 ${Math.round(MAX_RESUME_FILE_BYTES / 1024 / 1024)} MB，已作为附件保存，但无法智能识别，请手动填写姓名和联系方式。`);
        return;
      }

      setIsParsingResume(true);
      const reader = new FileReader();
      reader.onload = async () => {
        const base64 = (reader.result as string).split(',')[1];
        const parsed = await parseResumeData(base64, file.type);
        if (parsed) {
          setCandidateForm(prev => ({
            ...prev,
            name: parsed.name || prev.name,
            contactInfo: parsed.contactInfo || prev.contactInfo
          }));
        }
        setIsParsingResume(false);
      };
      reader.onerror = () => {
        // Without this the spinner would spin forever on an unreadable file.
        setIsParsingResume(false);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleStartMatching = async () => {
    if (!matchingJobId) return;
    setIsMatchingLoading(true);
    setMatchingResults([]);
    
    const selectedJob = jobs.find(j => j.id === matchingJobId);
    if (!selectedJob) return;

    const talentPoolCandidates = candidates
      .filter(c => c.status === CandidateStatus.BACKUP)
      .map(c => ({ id: c.id, name: c.name, notes: c.notes.map(n => n.text).join('; ') }));

    if (talentPoolCandidates.length === 0) {
      alert("储备库中暂无候选人");
      setIsMatchingLoading(false);
      return;
    }

    const results = await matchTalentToJob(selectedJob.title, selectedJob.description, talentPoolCandidates);
    setMatchingResults(results);
    setIsMatchingLoading(false);
  };

  const jobSpecificCandidates = useMemo(() => {
    if (!viewingJobDetailId) return [];
    return candidates.filter(c => c.jobId === viewingJobDetailId);
  }, [candidates, viewingJobDetailId]);

  const viewingJob = useMemo(() => {
    return jobs.find(j => j.id === viewingJobDetailId);
  }, [jobs, viewingJobDetailId]);

  // Data Export/Import Handler
  const handleExportData = () => {
    const data = {
      jobs,
      candidates,
      exportDate: new Date().toISOString(),
      version: '1.0'
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `hireflow_backup_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleImportData = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target?.result as string);
        if (data.jobs && Array.isArray(data.jobs)) setJobs(data.jobs);
        if (data.candidates && Array.isArray(data.candidates)) setCandidates(data.candidates);
        alert('数据恢复成功！');
      } catch (error) {
        alert('文件格式错误，无法恢复数据');
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      {/* Mobile Menu Overlay */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/50 z-40 md:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed inset-y-0 left-0 z-50 w-64 bg-slate-900 text-slate-300 flex flex-col shrink-0 transform transition-transform duration-300 ease-in-out
        md:relative md:translate-x-0
        ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="p-6 border-b border-slate-800 flex items-center gap-3">
          <div className="w-8 h-8 bg-indigo-500 rounded-lg flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <TrendingUp className="text-white size-5" />
          </div>
          <span className="font-bold text-xl text-white tracking-tight">HireFlow Pro</span>
        </div>
        <nav className="flex-1 p-4 space-y-2">
          {[
            { id: 'dashboard', label: '仪表盘', icon: <Layout size={18} /> },
            { id: 'jobs', label: '招聘需求 & JD', icon: <Briefcase size={18} /> },
            { id: 'pipeline', label: '招聘流程 SOP', icon: <Users size={18} /> },
            { id: 'talent-pool', label: '人才储备库', icon: <Database size={18} /> }
          ].map((tab) => (
            <button 
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg transition-all ${activeTab === tab.id ? 'bg-slate-800 text-white shadow-lg border border-slate-700' : 'hover:bg-slate-800 text-slate-400'}`}
            >
              {tab.icon}
              <span className="text-sm font-medium">{tab.label}</span>
            </button>
          ))}
        </nav>
        <div className="p-4 border-t border-slate-800 space-y-4">
          <div className="flex items-center gap-2 px-2">
             <button 
               onClick={handleExportData}
               className="flex-1 flex flex-col items-center gap-1 p-2 rounded-lg bg-slate-800 hover:bg-slate-700 transition-colors text-xs text-slate-400 hover:text-white"
               title="导出数据备份"
             >
               <Download size={16} />
               <span>备份数据</span>
             </button>
             <label className="flex-1 flex flex-col items-center gap-1 p-2 rounded-lg bg-slate-800 hover:bg-slate-700 transition-colors text-xs text-slate-400 hover:text-white cursor-pointer" title="恢复数据备份">
               <Upload size={16} />
               <span>恢复数据</span>
               <input type="file" accept=".json" onChange={handleImportData} className="hidden" />
             </label>
          </div>

          <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
            <p className="text-xs font-semibold uppercase text-slate-500 mb-2 tracking-wider">当前流程进度</p>
            <div className="flex items-center justify-between">
              <span className="text-2xl font-bold text-white">{stats.pipeline}</span>
              <span className="text-xs text-indigo-400 font-bold">活跃候选人</span>
            </div>
            <div className="mt-2 w-full bg-slate-700 h-1.5 rounded-full overflow-hidden">
              <div 
                className="bg-indigo-500 h-full transition-all duration-1000" 
                style={{ width: `${Math.min(100, (stats.pipeline / 10) * 100)}%` }}
              ></div>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden w-full">
        <header className="h-16 bg-white border-b flex items-center justify-between px-4 md:px-8 shadow-sm z-10 shrink-0">
          <div className="flex items-center gap-3">
            <button 
              className="md:hidden p-2 -ml-2 text-slate-500 hover:bg-slate-100 rounded-lg"
              onClick={() => setIsMobileMenuOpen(true)}
            >
              <Menu size={20} />
            </button>
            <h1 className="text-lg font-bold text-slate-800 tracking-wide truncate max-w-[200px] md:max-w-none">
              {activeTab === 'dashboard' && '数据分析仪表盘'}
              {activeTab === 'jobs' && '职位库与需求管理'}
              {activeTab === 'pipeline' && '招聘 SOP 操作看板'}
              {activeTab === 'talent-pool' && '人才储备管理'}
            </h1>
          </div>
          <div className="flex items-center gap-4">
            <div className="relative group">
              <Search className={`absolute left-3 top-1/2 -translate-y-1/2 transition-colors ${searchTerm ? 'text-indigo-500' : 'text-slate-400'}`} size={16} />
              <input 
                type="text" 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="搜索人才、职位或关键字..." 
                className="pl-10 pr-10 py-1.5 bg-slate-100 border-none rounded-full text-sm focus:ring-2 focus:ring-indigo-500 w-80 transition-all placeholder:text-slate-400 font-medium" 
              />
              {searchTerm && (
                <button onClick={() => setSearchTerm('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1">
                  <X size={14} />
                </button>
              )}
            </div>
            <div className="w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold text-xs ring-2 ring-indigo-100">HR</div>
          </div>
        </header>

        <div className="flex-1 overflow-auto p-4 md:p-8 bg-slate-50/50">
          {/* DASHBOARD - Reverted to Template 1 */}
          {activeTab === 'dashboard' && (
            <div className="space-y-8 animate-in fade-in duration-500 pb-20 md:pb-0">
              <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
                <div className="bg-white p-4 md:p-6 rounded-2xl shadow-sm border border-slate-100 hover:shadow-md transition-shadow relative">
                  <div className="flex items-center justify-between mb-3 md:mb-4">
                    <div className="p-2 md:p-3 rounded-xl bg-blue-50 text-blue-600"><FileText size={20} className="md:w-6 md:h-6"/></div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest hidden md:inline">累计简历</span>
                  </div>
                  <div className="text-2xl md:text-3xl font-bold text-slate-900">{stats.total}</div>
                  <div className="text-xs text-slate-400 mt-1 truncate">有效人才沉淀</div>
                </div>

                <div className="bg-white p-4 md:p-6 rounded-2xl shadow-sm border border-slate-100 hover:shadow-md transition-shadow">
                  <div className="flex items-center justify-between mb-3 md:mb-4">
                    <div className="p-2 md:p-3 rounded-xl bg-emerald-50 text-emerald-600"><CheckCircle size={20} className="md:w-6 md:h-6"/></div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest hidden md:inline">已入职</span>
                  </div>
                  <div className="text-2xl md:text-3xl font-bold text-slate-900">{stats.hired}</div>
                  <div className="text-xs text-slate-400 mt-1 truncate">本年度目标 24/50</div>
                </div>

                <div className="bg-white p-4 md:p-6 rounded-2xl shadow-sm border border-slate-100 hover:shadow-md transition-shadow">
                  <div className="flex items-center justify-between mb-3 md:mb-4">
                    <div className="p-2 md:p-3 rounded-xl bg-cyan-50 text-cyan-600"><Database size={20} className="md:w-6 md:h-6"/></div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest hidden md:inline">人才储备</span>
                  </div>
                  <div className="text-2xl md:text-3xl font-bold text-slate-900">{stats.backup}</div>
                  <div className="text-xs text-slate-400 mt-1 truncate">随时可激活</div>
                </div>

                <div className="bg-white p-4 md:p-6 rounded-2xl shadow-sm border border-slate-100 hover:shadow-md transition-shadow">
                  <div className="flex items-center justify-between mb-3 md:mb-4">
                    <div className="p-2 md:p-3 rounded-xl bg-amber-50 text-amber-600"><TrendingUp size={20} className="md:w-6 md:h-6"/></div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest hidden md:inline">面试通过率</span>
                  </div>
                  <div className="text-2xl md:text-3xl font-bold text-slate-900">42%</div>
                  <div className="text-xs text-emerald-500 mt-1 font-bold truncate">同比上月提升 5%</div>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8">
                {/* AI Recruitment Insights */}
                <div className="lg:col-span-2 bg-white p-6 md:p-8 rounded-3xl border border-slate-100 shadow-sm space-y-6">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                       <MessageSquare className="text-indigo-500" size={20} />
                       <h3 className="font-bold text-slate-800">AI 招聘洞察 & 策略生成</h3>
                    </div>
                    <button className="w-full md:w-auto px-4 py-2 md:py-1.5 bg-indigo-50 text-indigo-600 text-xs font-bold rounded-lg hover:bg-indigo-100 transition-colors">
                      生成最新诊断
                    </button>
                  </div>
                  <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 md:p-6 flex items-start gap-4">
                     <div className="p-2 bg-indigo-500 text-white rounded-lg shrink-0"><TrendingUp size={16} /></div>
                     <p className="text-sm text-slate-600 leading-relaxed">
                        点击“生成最新诊断”按钮，利用 AI 分析当前职位的招聘策略与候选人评估点。系统将自动提取核心技能关键词。
                     </p>
                  </div>
                </div>

                {/* Channel Ranking */}
                <div className="bg-white p-6 md:p-8 rounded-3xl border border-slate-100 shadow-sm space-y-6">
                  <div className="flex items-center gap-3">
                    <BarChart className="text-indigo-500" size={20} />
                    <h3 className="font-bold text-slate-800">渠道转化排行</h3>
                  </div>
                  <div className="space-y-4">
                    {stats.ranking.length > 0 ? stats.ranking.map((item, idx) => (
                      <div key={idx} className="space-y-1.5">
                        <div className="flex justify-between text-xs font-bold">
                           <span className="text-slate-700">{item.name}</span>
                           <span className="text-slate-400">{item.count} 份</span>
                        </div>
                        <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                           <div 
                             className="bg-indigo-500 h-full rounded-full transition-all duration-700" 
                             style={{ width: `${(item.count / Math.max(...stats.ranking.map(r => r.count))) * 100}%` }}
                           ></div>
                        </div>
                      </div>
                    )) : (
                      <p className="text-sm text-slate-400 text-center py-10">暂无渠道数据</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* PIPELINE VIEW */}
          {activeTab === 'pipeline' && (
            <div className="h-full flex flex-col gap-6 animate-in slide-in-from-bottom-4 duration-500">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center shrink-0 gap-4">
                <div className="flex items-center gap-3 w-full md:w-auto">
                  <div className="bg-white px-4 py-2 rounded-xl border shadow-sm flex items-center gap-3 w-full md:w-auto">
                    <Filter size={14} className="text-indigo-500 shrink-0" />
                    <select 
                      value={selectedJobId} 
                      onChange={(e) => setSelectedJobId(e.target.value)} 
                      className="text-sm bg-transparent border-none outline-none font-bold text-slate-700 w-full md:w-auto"
                    >
                      <option value="all">所有职位看板</option>
                      {jobs.filter(j => j.status === 'OPEN').map(j => <option key={j.id} value={j.id}>{j.title}</option>)}
                    </select>
                  </div>
                </div>
                <button onClick={() => { setCandidateForm({...candidateForm, isPoolDirect: false, resumeFile: null, notes: '', jobId: ''}); setIsAddingCandidate(true); setEditingCandidateId(null); }} className="w-full md:w-auto flex justify-center items-center gap-2 bg-indigo-600 text-white px-5 py-2.5 rounded-xl text-sm font-bold hover:bg-indigo-700 shadow-lg shadow-indigo-100 transition-all active:scale-95">
                  <Plus size={18} /> 录入候选人
                </button>
              </div>

              <div className="flex-1 overflow-x-auto kanban-scrollbar flex gap-4 pb-4">
                {kanbanStages.map(stage => (
                  <div key={stage} className="min-w-[320px] w-[320px] bg-slate-200/40 rounded-2xl flex flex-col border border-slate-200/50">
                    <div className="p-4 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className={`w-2.5 h-2.5 rounded-full ${STATUS_LABELS[stage]?.color.split(' ')[0] || 'bg-slate-400'}`}></div>
                        <h3 className="font-bold text-sm text-slate-700 tracking-tight">{STATUS_LABELS[stage]?.label}</h3>
                      </div>
                      <span className="bg-white/80 px-2.5 py-0.5 rounded-lg text-xs text-slate-500 font-bold border border-slate-200">
                        {filteredCandidates.filter(c => c.status === stage).length}
                      </span>
                    </div>
                    <div className="flex-1 overflow-y-auto p-3 space-y-3">
                      {filteredCandidates.filter(c => c.status === stage).map(candidate => (
                        <div 
                          key={candidate.id} 
                          className={`bg-white p-4 rounded-xl shadow-sm border transition-all group hover:shadow-md cursor-pointer relative overflow-hidden flex flex-col gap-3 ${
                            candidate.stageStatus === 'FAILED' ? 'border-red-200 bg-red-50/10' : 
                            candidate.stageStatus === 'APPROVED' ? 'border-emerald-200 bg-emerald-50/10' : 'border-slate-100 hover:border-indigo-400'
                          }`}
                        >
                          <div className="flex justify-between items-start">
                            <div className="flex flex-col">
                              <span className="font-bold text-slate-900 text-base">{candidate.name}</span>
                              <span className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">{jobs.find(j => j.id === candidate.jobId)?.title || '未分配'}</span>
                            </div>
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button onClick={(e) => { e.stopPropagation(); handleStartEditCandidate(candidate); }} className="p-1 hover:bg-indigo-50 text-indigo-500 rounded transition-colors" title="编辑候选人">
                                <Pencil size={14} />
                              </button>
                              <button onClick={(e) => { e.stopPropagation(); handleToggleHighPotential(candidate.id); }}>
                                <Star size={16} className={`${candidate.isHighPotential ? 'fill-amber-400 text-amber-400' : 'text-slate-300'}`} />
                              </button>
                            </div>
                          </div>
                          
                          <div className="flex flex-col gap-2 p-2 bg-slate-50 rounded-xl border border-slate-100">
                            <div className="flex items-center justify-between gap-1">
                              <button 
                                onClick={(e) => { e.stopPropagation(); handleUpdateStageStatus(candidate.id, 'PENDING'); }}
                                className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                  candidate.stageStatus === 'PENDING' ? 'bg-amber-100 text-amber-700 shadow-inner' : 'text-slate-400 hover:bg-slate-200/50'
                                }`}
                              >
                                <CircleDashed size={14} /> 待处理
                              </button>
                              <button 
                                onClick={(e) => { e.stopPropagation(); handleUpdateStageStatus(candidate.id, 'APPROVED'); }}
                                className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                  candidate.stageStatus === 'APPROVED' ? 'bg-emerald-100 text-emerald-700 shadow-inner' : 'text-slate-400 hover:bg-slate-200/50'
                                }`}
                              >
                                <CheckCircle size={14} /> 通过
                              </button>
                              <button 
                                onClick={(e) => { e.stopPropagation(); handleUpdateStageStatus(candidate.id, 'FAILED'); }}
                                className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                  candidate.stageStatus === 'FAILED' ? 'bg-red-100 text-red-700 shadow-inner' : 'text-slate-400 hover:bg-slate-200/50'
                                }`}
                              >
                                <XCircle size={14} /> 不通过
                              </button>
                            </div>
                          </div>

                          <div className="flex flex-col gap-1 mt-1 group/remarks">
                            <div className="flex items-center justify-between">
                              <span className="flex items-center gap-1 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                <MessageSquare size={10} className="text-slate-300" /> 跟进记录 ({candidate.notes.length})
                              </span>
                              <button 
                                onClick={(e) => { e.stopPropagation(); setEditingNotesId(candidate.id); setTempNotes(''); }}
                                className="opacity-0 group-hover/remarks:opacity-100 transition-opacity p-1 hover:bg-slate-100 rounded text-indigo-500"
                              >
                                <Plus size={12} />
                              </button>
                            </div>
                            
                            {editingNotesId === candidate.id ? (
                              <div className="space-y-2 animate-in fade-in slide-in-from-top-1">
                                <textarea 
                                  autoFocus
                                  value={tempNotes}
                                  onChange={(e) => setTempNotes(e.target.value)}
                                  placeholder="添加新的备注说明..."
                                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-indigo-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none min-h-[60px] resize-none font-medium text-slate-700"
                                />
                                <div className="flex justify-end gap-1.5">
                                  <button onClick={(e) => { e.stopPropagation(); setEditingNotesId(null); }} className="px-2 py-1 text-[10px] font-bold text-slate-400 hover:text-slate-600">取消</button>
                                  <button onClick={(e) => { e.stopPropagation(); handleSaveNotes(candidate.id); }} className="px-3 py-1 bg-indigo-600 text-white rounded-lg text-[10px] font-bold shadow-sm hover:bg-indigo-700">保存</button>
                                </div>
                              </div>
                            ) : (
                              <div className="max-h-[80px] overflow-y-auto kanban-scrollbar space-y-2">
                                {candidate.notes.length > 0 ? (
                                  candidate.notes.map((note) => (
                                    <div key={note.id} className="text-[11px] leading-relaxed border-l-2 border-indigo-100 pl-2">
                                      <p className="text-slate-600 font-medium">{note.text}</p>
                                      <p className="text-[9px] text-slate-400">{note.timestamp}</p>
                                    </div>
                                  ))
                                ) : (
                                  <p className="text-xs text-slate-300 italic">暂无跟进记录...</p>
                                )}
                              </div>
                            )}
                          </div>

                          <div className="flex items-center justify-between mt-1 pt-3 border-t border-slate-50">
                             <div className="flex gap-1.5">
                                <span className="text-[10px] px-2 py-0.5 bg-slate-100 text-slate-600 rounded font-bold uppercase tracking-tighter">{candidate.source}</span>
                                {candidate.resumeFileName ? (
                                  <a 
                                    href={candidate.resumeUrl} 
                                    download={candidate.resumeFileName}
                                    onClick={(e) => e.stopPropagation()}
                                    className="text-[10px] px-2 py-0.5 bg-indigo-50 text-indigo-600 rounded font-bold flex items-center gap-1 hover:bg-indigo-100 transition-colors"
                                  >
                                    <Paperclip size={10} /> {candidate.resumeFileName}
                                  </a>
                                ) : (
                                  <span className="text-[10px] px-2 py-0.5 bg-slate-50 text-slate-400 rounded font-bold flex items-center gap-1 opacity-50"><Paperclip size={10} /> 无简历</span>
                                )}
                             </div>
                             
                             <div className="flex items-center gap-1">
                                {candidate.stageStatus === 'APPROVED' && (
                                   <>
                                      <button 
                                        onClick={(e) => { e.stopPropagation(); handleAdvanceStage(candidate); }}
                                        className="bg-indigo-600 text-white px-2.5 py-1 rounded-lg text-[10px] font-black uppercase flex items-center gap-1 hover:bg-indigo-700 transition-all shadow-md shadow-indigo-100"
                                      >
                                         推进 <MoveRight size={12}/>
                                      </button>
                                      
                                      {[CandidateStatus.INTERVIEW_1, CandidateStatus.INTERVIEW_2, CandidateStatus.INTERVIEW_3].includes(candidate.status) && (
                                        <button 
                                          onClick={(e) => { e.stopPropagation(); handleJumpToOffer(candidate.id); }}
                                          className="bg-amber-500 text-white px-2.5 py-1 rounded-lg text-[10px] font-black uppercase flex items-center gap-1 hover:bg-amber-600 transition-all shadow-md shadow-amber-100"
                                          title="直接跳至入职确认阶段"
                                        >
                                           入职 <FastForward size={12}/>
                                        </button>
                                      )}
                                   </>
                                )}
                                {candidate.stageStatus === 'FAILED' && (
                                   <button 
                                     onClick={(e) => { e.stopPropagation(); handleMoveToBackup(candidate.id); }}
                                     className="bg-slate-100 text-slate-600 px-2.5 py-1 rounded-lg text-[10px] font-black uppercase flex items-center gap-1 hover:bg-slate-200 transition-all"
                                   >
                                      转储备 <Archive size={12}/>
                                   </button>
                                )}
                             </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* JOBS VIEW */}
          {activeTab === 'jobs' && (
            <div className="space-y-8 animate-in fade-in duration-500 h-full flex flex-col">
              <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4 shrink-0">
                <div>
                  <h2 className="text-2xl font-bold text-slate-800 tracking-tight">招聘需求 & JD 管理</h2>
                  <p className="text-sm text-slate-500 mt-1 font-medium">清晰划分正式 HC 与实习生资源</p>
                </div>
                <button onClick={() => setIsAddingJob(true)} className="w-full md:w-auto flex items-center justify-center gap-2 bg-indigo-600 text-white px-5 py-3 rounded-xl font-bold shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all active:scale-95">
                  <Plus size={20} /> 发布新职位
                </button>
              </div>

              <div className="flex items-center justify-between shrink-0 overflow-x-auto pb-2">
                <div className="flex items-center gap-2 bg-white p-1.5 rounded-2xl border border-slate-200 shadow-sm min-w-max">
                  <button onClick={() => setJobStatusFilter('OPEN')} className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold transition-all ${jobStatusFilter === 'OPEN' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}>
                    <PlayCircle size={18}/> 正在进行
                  </button>
                  <button onClick={() => setJobStatusFilter('CLOSED')} className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold transition-all ${jobStatusFilter === 'CLOSED' ? 'bg-slate-800 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}>
                    <Archive size={18}/> 已关闭
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto space-y-12 pb-12 pr-2 kanban-scrollbar">
                <section>
                  <div className="flex items-center gap-3 mb-6">
                    <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
                      <UserSearch size={20} />
                    </div>
                    <h3 className="text-lg font-bold text-slate-800">正式 HC (Full-time)</h3>
                    <span className="bg-indigo-600 text-white text-[10px] font-black px-2 py-0.5 rounded-full">{fullTimeJobs.length}</span>
                  </div>
                  
                  {fullTimeJobs.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {fullTimeJobs.map(job => (
                        <div key={job.id} onClick={() => setViewingJobDetailId(job.id)} className={`bg-white p-6 rounded-2xl shadow-sm border border-slate-100 hover:shadow-xl transition-all group h-fit relative cursor-pointer ${job.status === 'CLOSED' ? 'opacity-75' : ''}`}>
                          <div className="flex justify-between items-start mb-4">
                            <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-md uppercase border border-indigo-100 tracking-wider">{job.department}</span>
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                               <div className="p-1.5 bg-indigo-600 text-white rounded-lg shadow-sm">
                                  <Eye size={14} />
                               </div>
                            </div>
                          </div>
                          <h3 className="text-xl font-bold text-slate-800 mb-2 group-hover:text-indigo-600 transition-colors">{job.title}</h3>
                          <div className="flex items-center gap-2 mb-4">
                             <Users size={14} className="text-slate-400" />
                             <span className="text-xs font-bold text-slate-500">
                                {candidates.filter(c => c.jobId === job.id).length} 名候选人
                             </span>
                          </div>
                          <p className="text-sm text-slate-500 line-clamp-2 mb-4 leading-relaxed">{job.description}</p>
                          <div className="mt-6 pt-6 border-t border-slate-50 flex justify-between items-center">
                            <div className="flex items-center gap-2">
                                {job.status === 'OPEN' ? (
                                  <button onClick={(e) => { e.stopPropagation(); handleToggleJobStatus(job.id); }} title="关闭职位" className="bg-slate-50 text-slate-600 p-2.5 rounded-xl hover:bg-slate-800 hover:text-white transition-all shadow-sm"><Power size={18} /></button>
                                ) : (
                                  <button onClick={(e) => { e.stopPropagation(); handleToggleJobStatus(job.id); }} className="bg-emerald-50 text-emerald-600 px-4 py-2 rounded-xl text-xs font-bold hover:bg-emerald-600 hover:text-white transition-all flex items-center gap-1.5 shadow-sm"><RotateCcw size={16} /> 重新开启</button>
                                )}
                                <button onClick={(e) => { e.stopPropagation(); handleDeleteJob(job.id); }} className="bg-red-50 text-red-600 p-2.5 rounded-xl hover:bg-red-600 hover:text-white transition-all shadow-sm"><Trash2 size={18} /></button>
                            </div>
                            <span className="text-[10px] text-slate-400 font-medium">创建: {job.createDate}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="bg-white/50 border-2 border-dashed border-slate-200 rounded-2xl p-10 flex flex-col items-center justify-center text-slate-400">
                      <p className="font-bold text-sm">暂无该类型的职位</p>
                    </div>
                  )}
                </section>

                <section>
                  <div className="flex items-center gap-3 mb-6">
                    <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
                      <School size={20} />
                    </div>
                    <h3 className="text-lg font-bold text-slate-800">实习生需求 (Intern)</h3>
                    <span className="bg-emerald-600 text-white text-[10px] font-black px-2 py-0.5 rounded-full">{internJobs.length}</span>
                  </div>
                  
                  {internJobs.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {internJobs.map(job => (
                        <div key={job.id} onClick={() => setViewingJobDetailId(job.id)} className={`bg-white p-6 rounded-2xl shadow-sm border border-emerald-50 hover:shadow-xl transition-all group h-fit relative cursor-pointer ${job.status === 'CLOSED' ? 'opacity-75' : ''}`}>
                          <div className="flex justify-between items-start mb-4">
                            <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-md uppercase border border-emerald-100 tracking-wider">{job.department}</span>
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                               <div className="p-1.5 bg-emerald-600 text-white rounded-lg shadow-sm">
                                  <Eye size={14} />
                               </div>
                            </div>
                          </div>
                          <h3 className="text-xl font-bold text-slate-800 mb-2 group-hover:text-emerald-600 transition-colors">{job.title}</h3>
                          <div className="flex items-center gap-2 mb-4">
                             <Users size={14} className="text-slate-400" />
                             <span className="text-xs font-bold text-slate-500">
                                {candidates.filter(c => c.jobId === job.id).length} 名候选人
                             </span>
                          </div>
                          <p className="text-sm text-slate-500 line-clamp-2 mb-4 leading-relaxed">{job.description}</p>
                          <div className="mt-6 pt-6 border-t border-slate-50 flex justify-between items-center">
                            <div className="flex items-center gap-2">
                                {job.status === 'OPEN' ? (
                                  <button onClick={(e) => { e.stopPropagation(); handleToggleJobStatus(job.id); }} title="关闭职位" className="bg-slate-50 text-slate-600 p-2.5 rounded-xl hover:bg-slate-800 hover:text-white transition-all shadow-sm"><Power size={18} /></button>
                                ) : (
                                  <button onClick={(e) => { e.stopPropagation(); handleToggleJobStatus(job.id); }} className="bg-emerald-50 text-emerald-600 px-4 py-2 rounded-xl text-xs font-bold hover:bg-emerald-600 hover:text-white transition-all flex items-center gap-1.5 shadow-sm"><RotateCcw size={16} /> 重新开启</button>
                                )}
                                <button onClick={(e) => { e.stopPropagation(); handleDeleteJob(job.id); }} className="bg-red-50 text-red-600 p-2.5 rounded-xl hover:bg-red-600 hover:text-white transition-all shadow-sm"><Trash2 size={18} /></button>
                            </div>
                            <span className="text-[10px] text-slate-400 font-medium">创建: {job.createDate}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="bg-white/50 border-2 border-dashed border-slate-200 rounded-2xl p-10 flex flex-col items-center justify-center text-slate-400">
                      <p className="font-bold text-sm">暂无该类型的职位</p>
                    </div>
                  )}
                </section>
              </div>
            </div>
          )}

          {/* TALENT POOL VIEW */}
          {activeTab === 'talent-pool' && (
            <div className="space-y-8 animate-in fade-in duration-500">
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="text-2xl font-bold text-slate-800">人才储备库</h2>
                  <p className="text-sm text-slate-500 mt-1 font-medium">优秀人才独立入库，支持AI智能匹配与跨职位激活</p>
                </div>
                <div className="flex items-center gap-3">
                  <button 
                    onClick={() => { setMatchingJobId(''); setMatchingResults([]); setIsMatchingModalOpen(true); }}
                    className="flex items-center gap-2 bg-gradient-to-r from-indigo-600 to-violet-600 text-white px-5 py-2.5 rounded-xl text-sm font-bold hover:shadow-lg hover:shadow-indigo-200 transition-all active:scale-95 group"
                  >
                    <Sparkles size={18} className="group-hover:animate-pulse" /> AI 职位对标
                  </button>
                  <button 
                    onClick={() => { setCandidateForm({...candidateForm, isPoolDirect: true, resumeFile: null, notes: '', jobId: ''}); setIsAddingCandidate(true); setEditingCandidateId(null); }}
                    className="flex items-center gap-2 bg-cyan-600 text-white px-5 py-2.5 rounded-xl text-sm font-bold hover:bg-cyan-700 shadow-lg shadow-cyan-100 transition-all active:scale-95"
                  >
                    <UserPlus size={18} /> 录入储备人才
                  </button>
                </div>
              </div>

              <div className="relative group max-w-xl">
                <Search className={`absolute left-4 top-1/2 -translate-y-1/2 transition-colors ${talentPoolSearchTerm ? 'text-cyan-500' : 'text-slate-400'}`} size={18} />
                <input 
                  type="text" 
                  value={talentPoolSearchTerm}
                  onChange={(e) => setTalentPoolSearchTerm(e.target.value)}
                  placeholder="在人才储备库中搜索 (姓名、备注、联系方式)..." 
                  className="w-full pl-12 pr-12 py-3 bg-white border border-slate-200 rounded-2xl text-sm font-medium focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 outline-none shadow-sm transition-all placeholder:text-slate-400" 
                />
                {talentPoolSearchTerm && (
                  <button onClick={() => setTalentPoolSearchTerm('')} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1">
                    <X size={16} />
                  </button>
                )}
              </div>

              {Object.entries(talentPoolGroups).length > 0 ? (
                Object.entries(talentPoolGroups).map(([dept, people]: [string, any[]]) => (
                  <div key={dept} className="space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="h-px bg-slate-200 flex-1"></div>
                      <div className="flex items-center gap-2 px-4 py-1.5 bg-white border border-slate-100 rounded-full shadow-sm">
                        <Tags size={14} className="text-cyan-500" />
                        <span className="text-xs font-black text-slate-600 uppercase tracking-widest">{dept}</span>
                        <span className="bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded text-[10px] font-bold">{people.length}</span>
                      </div>
                      <div className="h-px bg-slate-200 flex-1"></div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                      {people.map(c => (
                        <div key={c.id} className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm hover:shadow-xl transition-all group relative overflow-hidden flex flex-col gap-4">
                          <div className="flex items-start gap-4">
                            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-cyan-500 to-indigo-600 text-white flex items-center justify-center font-bold text-lg shadow-lg shadow-indigo-100 shrink-0">
                              {c.name.charAt(0)}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <h4 className="font-bold text-slate-900 truncate text-base">{c.name}</h4>
                                  {c.isHighPotential && <Star size={14} className="fill-amber-400 text-amber-400 shrink-0" />}
                                </div>
                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                   <button onClick={() => handleStartEditCandidate(c)} className="p-1.5 hover:bg-slate-100 text-indigo-500 rounded transition-all">
                                      <Pencil size={14} />
                                   </button>
                                   <button onClick={() => handlePermanentDelete(c.id)} className="p-1.5 hover:bg-red-50 text-red-500 rounded transition-all">
                                      <UserMinus size={14} />
                                   </button>
                                </div>
                              </div>
                              <p className="text-xs text-slate-400 font-medium truncate mt-0.5">
                                 {c.contactInfo} · 投递: {jobs.find(j => j.id === c.jobId)?.title || '直接入库'}
                              </p>
                            </div>
                          </div>

                          <div className="bg-slate-50/80 p-3 rounded-xl border border-slate-100/50 max-h-[60px] overflow-hidden">
                             <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed italic">
                                "{c.notes.length > 0 ? c.notes[0].text : '暂无备注说明...'}"
                             </p>
                          </div>

                          {assigningCandidateId === c.id ? (
                            <div className="space-y-2 p-3 bg-slate-50 rounded-xl border border-indigo-100 animate-in fade-in slide-in-from-top-2">
                              <label className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">分配至活跃职位</label>
                              <div className="flex flex-col gap-2">
                                <select 
                                  className="w-full text-xs font-bold p-2 rounded-lg border-none bg-white shadow-sm ring-1 ring-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none"
                                  onChange={(e) => e.target.value && handleAssignToJob(c.id, e.target.value)}
                                  defaultValue=""
                                >
                                  <option value="" disabled>选择一个正在招聘的职位...</option>
                                  {jobs.filter(j => j.status === 'OPEN').map(j => (
                                    <option key={j.id} value={j.id}>{j.title} ({j.department})</option>
                                  ))}
                                </select>
                                <button onClick={() => setAssigningCandidateId(null)} className="text-[10px] text-slate-400 hover:text-red-500 font-bold transition-colors">取消分配</button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              <button 
                                onClick={() => setAssigningCandidateId(c.id)}
                                className="flex-1 py-2 bg-indigo-600 text-white font-bold rounded-xl text-xs hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 flex items-center justify-center gap-2"
                              >
                                 <ArrowRight size={14} /> 分配职位并激活
                              </button>
                              {c.resumeUrl && (
                                <a href={c.resumeUrl} download={c.resumeFileName} className="p-2 bg-slate-100 text-slate-400 rounded-xl hover:bg-slate-200 hover:text-slate-600 transition-all">
                                  <FileArchive size={16}/>
                                </a>
                              )}
                            </div>
                          )}
                          
                          <div className="text-[10px] text-slate-400 flex justify-between items-center px-1">
                             <span className="flex items-center gap-1"><Search size={10}/> {c.source}</span>
                             <span className="flex items-center gap-1 font-bold text-slate-500"><Clock size={10}/> 已沉淀</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              ) : (
                <div className="h-80 flex flex-col items-center justify-center text-slate-300 gap-4 border-2 border-dashed border-slate-200 rounded-3xl bg-white/50">
                   <Users size={64} className="opacity-10" />
                   <div className="text-center">
                      <p className="font-bold text-lg text-slate-400">未找到匹配的候选人</p>
                      <p className="text-sm mt-1">尝试更换关键词或录入更多储备人才</p>
                   </div>
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      {/* AI Job Matching Modal */}
      {isMatchingModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-4xl max-h-[90vh] rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in duration-300 flex flex-col">
             <div className="px-8 py-6 border-b flex justify-between items-center bg-gradient-to-r from-indigo-600 to-violet-700 text-white">
                <div className="flex items-center gap-3">
                   <div className="p-2 bg-white/20 rounded-xl backdrop-blur-md">
                      <Sparkles size={24} className="text-amber-200" />
                   </div>
                   <div>
                      <h2 className="text-xl font-bold">AI 智能人才对标</h2>
                      <p className="text-xs opacity-80">利用 Gemini 大模型为您的职位匹配储备人才</p>
                   </div>
                </div>
                <button onClick={() => setIsMatchingModalOpen(false)} className="hover:bg-white/20 p-2 rounded-full transition-colors"><X size={24} /></button>
             </div>
             
             <div className="flex-1 overflow-y-auto p-8 space-y-8 kanban-scrollbar">
                <section className="space-y-4">
                   <div className="flex items-center gap-2 text-slate-800 font-bold">
                      <div className="w-1 h-5 bg-indigo-500 rounded-full"></div>
                      步骤 1: 选择对标职位
                   </div>
                   <div className="flex gap-4 items-end">
                      <div className="flex-1 space-y-1">
                         <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">正在招聘的职位</label>
                         <select 
                           value={matchingJobId}
                           onChange={(e) => setMatchingJobId(e.target.value)}
                           className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                         >
                            <option value="">请选择一个职位开始对标...</option>
                            {jobs.filter(j => j.status === 'OPEN').map(j => (
                               <option key={j.id} value={j.id}>{j.title} ({j.department})</option>
                            ))}
                         </select>
                      </div>
                      <button 
                         onClick={handleStartMatching}
                         disabled={!matchingJobId || isMatchingLoading}
                         className="px-8 py-3 bg-indigo-600 text-white font-bold rounded-2xl shadow-lg shadow-indigo-100 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2 shrink-0 active:scale-95"
                      >
                         {isMatchingLoading ? <Loader2 size={18} className="animate-spin" /> : <Zap size={18} />}
                         开始智能匹配
                      </button>
                   </div>
                </section>

                <section className="space-y-6">
                   <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-slate-800 font-bold">
                         <div className="w-1 h-5 bg-indigo-500 rounded-full"></div>
                         匹配结果 {matchingResults.length > 0 && `(${matchingResults.length})`}
                      </div>
                   </div>

                   {isMatchingLoading ? (
                      <div className="flex flex-col items-center justify-center py-20 space-y-4 animate-pulse">
                         <div className="relative">
                            <BrainCircuit size={64} className="text-indigo-200" />
                            <Sparkles size={24} className="text-amber-400 absolute -top-2 -right-2 animate-bounce" />
                         </div>
                         <div className="text-center">
                            <p className="text-slate-600 font-bold">AI 正在深度阅读简历与 JD...</p>
                            <p className="text-xs text-slate-400 mt-1">大约需要 5-10 秒钟</p>
                         </div>
                      </div>
                   ) : matchingResults.length > 0 ? (
                      <div className="grid grid-cols-1 gap-4">
                         {matchingResults.map((res, index) => {
                            const candidate = candidates.find(c => c.id === res.candidateId);
                            if (!candidate) return null;
                            return (
                               <div key={index} className="bg-slate-50 border border-slate-200 rounded-3xl p-6 flex items-start gap-6 hover:border-indigo-300 hover:bg-white transition-all group animate-in slide-in-from-bottom-2 duration-300" style={{animationDelay: `${index * 100}ms`}}>
                                  <div className="flex flex-col items-center gap-2">
                                     <div className="relative">
                                        <div className="w-16 h-16 rounded-3xl bg-indigo-600 text-white flex items-center justify-center text-2xl font-black shadow-xl shadow-indigo-100">
                                           {candidate.name.charAt(0)}
                                        </div>
                                        <div className="absolute -bottom-2 -right-2 bg-white px-2 py-1 rounded-full text-xs font-black border border-slate-100 shadow-md text-indigo-600">
                                           {res.matchScore}%
                                        </div>
                                     </div>
                                  </div>
                                  <div className="flex-1 space-y-3">
                                     <div className="flex justify-between items-start">
                                        <div>
                                           <h4 className="text-lg font-black text-slate-900">{candidate.name}</h4>
                                           <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{candidate.source} · {candidate.contactInfo}</p>
                                        </div>
                                        <button 
                                          onClick={() => {
                                            handleAssignToJob(candidate.id, matchingJobId);
                                            setIsMatchingModalOpen(false);
                                          }}
                                          className="px-4 py-2 bg-indigo-50 text-indigo-700 text-xs font-black rounded-xl hover:bg-indigo-600 hover:text-white transition-all shadow-sm flex items-center gap-1.5"
                                        >
                                           <CheckCircle size={14} /> 确认并激活
                                        </button>
                                     </div>
                                     <div className="bg-white p-4 rounded-2xl border border-indigo-50 shadow-sm relative">
                                        <div className="absolute top-0 left-0 w-1 h-full bg-indigo-500 rounded-full opacity-30"></div>
                                        <p className="text-sm text-slate-600 leading-relaxed italic">
                                           "{res.reason}"
                                        </p>
                                     </div>
                                  </div>
                               </div>
                            );
                         })}
                      </div>
                   ) : (
                      <div className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-3xl py-20 flex flex-col items-center justify-center text-slate-300 gap-4">
                         <Zap size={48} className="opacity-20" />
                         <p className="font-bold">等待对标开始...</p>
                      </div>
                   )}
                </section>
             </div>
             
             <div className="p-6 border-t bg-slate-50/50 flex justify-end">
                <button 
                  onClick={() => setIsMatchingModalOpen(false)}
                  className="px-6 py-2.5 font-bold text-slate-500 hover:text-slate-700 transition-colors"
                >
                   关闭
                </button>
             </div>
          </div>
        </div>
      )}

      {/* Viewing Job Detail / Specific Candidate List Modal */}
      {viewingJobDetailId && viewingJob && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[70] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-5xl h-[85vh] rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in duration-200 flex flex-col">
            <div className={`px-8 py-6 border-b flex justify-between items-center text-white ${viewingJob.type === 'INTERN' ? 'bg-emerald-600' : 'bg-indigo-600'}`}>
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/20 rounded-xl">
                  {viewingJob.type === 'INTERN' ? <School size={24} /> : <UserSearch size={24} />}
                </div>
                <div>
                  <h2 className="text-xl font-bold">{viewingJob.title}</h2>
                  <p className="text-xs opacity-80 font-medium uppercase tracking-widest">{viewingJob.department} · {viewingJob.type === 'INTERN' ? '实习生' : '正式HC'}</p>
                </div>
              </div>
              <button onClick={() => setViewingJobDetailId(null)} className="hover:bg-white/20 p-2 rounded-full transition-colors"><X size={24} /></button>
            </div>
            
            <div className="flex-1 overflow-hidden flex">
              {/* Left: Job Summary & JD */}
              <div className="w-1/3 border-r bg-slate-50 p-8 overflow-y-auto kanban-scrollbar">
                <div className="space-y-6">
                  <section>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">职位概览</label>
                    <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm space-y-3">
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-slate-400">当前状态</span>
                        <span className={`px-2 py-0.5 rounded font-bold text-xs ${viewingJob.status === 'OPEN' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'}`}>
                          {viewingJob.status === 'OPEN' ? '正在进行' : '已关闭'}
                        </span>
                      </div>
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-slate-400">创建日期</span>
                        <span className="font-bold text-slate-700">{viewingJob.createDate}</span>
                      </div>
                    </div>
                  </section>
                  
                  <section>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">职位描述 (JD)</label>
                    <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
                      <p className="text-sm text-slate-600 whitespace-pre-wrap leading-relaxed">{viewingJob.description}</p>
                    </div>
                  </section>
                </div>
              </div>

              {/* Right: Candidate List */}
              <div className="flex-1 p-8 overflow-y-auto kanban-scrollbar">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-lg font-bold text-slate-800">相关候选人 ({jobSpecificCandidates.length})</h3>
                  <button 
                    onClick={() => { 
                      setCandidateForm({...candidateForm, jobId: viewingJobDetailId, isPoolDirect: false, resumeFile: null, notes: ''}); 
                      setEditingCandidateId(null);
                      setIsAddingCandidate(true); 
                    }}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold text-white shadow-lg transition-all active:scale-95 ${viewingJob.type === 'INTERN' ? 'bg-emerald-600' : 'bg-indigo-600'}`}
                  >
                    <Plus size={16} /> 为该职位添加候选人
                  </button>
                </div>

                {jobSpecificCandidates.length > 0 ? (
                  <div className="space-y-8">
                    {kanbanStages.map(stage => {
                      const candidatesInStage = jobSpecificCandidates.filter(c => c.status === stage);
                      if (candidatesInStage.length === 0) return null;
                      return (
                        <div key={stage} className="space-y-3">
                          <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
                            <div className={`w-2 h-2 rounded-full ${STATUS_LABELS[stage]?.color.split(' ')[0] || 'bg-slate-400'}`}></div>
                            <h4 className="text-xs font-black text-slate-500 uppercase tracking-widest">{STATUS_LABELS[stage]?.label}</h4>
                            <span className="text-[10px] text-slate-300 font-bold ml-1">{candidatesInStage.length}</span>
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            {candidatesInStage.map(c => (
                              <div key={c.id} className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between group hover:border-indigo-200 transition-all">
                                <div className="flex items-center gap-4">
                                   <div className="w-10 h-10 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center font-bold text-sm">
                                      {c.name.charAt(0)}
                                   </div>
                                   <div>
                                      <div className="font-bold text-slate-800">{c.name}</div>
                                      <div className="text-[10px] text-slate-400 font-medium">来源: {c.source} · {c.contactInfo}</div>
                                   </div>
                                </div>
                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                   <button onClick={() => handleStartEditCandidate(c)} className="p-2 hover:bg-slate-50 text-indigo-500 rounded-xl transition-all" title="编辑资料">
                                      <Pencil size={14} />
                                   </button>
                                   <button onClick={() => { setViewingJobDetailId(null); setActiveTab('pipeline'); setSelectedJobId(viewingJobDetailId); }} className="p-2 hover:bg-indigo-50 text-indigo-600 rounded-xl transition-all" title="在看板中查看">
                                      <Layout size={14} />
                                   </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="h-64 flex flex-col items-center justify-center text-slate-300 gap-4 border-2 border-dashed border-slate-100 rounded-3xl">
                     <Users size={48} className="opacity-20" />
                     <p className="font-bold">暂无该职位的申请记录</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Job Modal */}
      {isAddingJob && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[70] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in duration-200">
            <div className="px-8 py-6 border-b flex justify-between items-center bg-indigo-600 text-white">
              <h2 className="text-xl font-bold flex items-center gap-2"><Briefcase /> 发布新招聘需求</h2>
              <button onClick={() => { setIsAddingJob(false); setManualDeptInput(false); setIsDeptDropdownOpen(false); }} className="hover:bg-white/20 p-1 rounded-full transition-colors"><X size={24} /></button>
            </div>
            <div className="p-8 space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase ml-1 tracking-wider">职位名称</label>
                  <input 
                    type="text" 
                    placeholder="如: 高级前端工程师" 
                    className="w-full px-4 py-3 bg-slate-100 border-none rounded-xl focus:ring-2 focus:ring-indigo-500 font-bold text-slate-800 outline-none transition-all" 
                    value={jobForm.title} 
                    onChange={(e) => setJobForm({...jobForm, title: e.target.value})} 
                  />
                </div>
                
                <div className="space-y-2 relative" ref={deptDropdownRef}>
                  <div className="flex justify-between items-center ml-1">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">所属部门</label>
                    <button 
                      onClick={() => setManualDeptInput(!manualDeptInput)}
                      className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 transition-colors"
                    >
                      {manualDeptInput ? (
                        <><List size={12}/> 选择已有</>
                      ) : (
                        <><TypeIcon size={12}/> 手动输入功能</>
                      )}
                    </button>
                  </div>

                  {manualDeptInput ? (
                    <div className="animate-in slide-in-from-right-2 duration-200">
                      <input 
                        autoFocus
                        type="text" 
                        placeholder="输入新部门名称..." 
                        className="w-full px-4 py-3 bg-indigo-50 border-2 border-indigo-100 rounded-xl focus:ring-2 focus:ring-indigo-500 font-bold text-slate-800 outline-none transition-all"
                        value={jobForm.department}
                        onChange={(e) => setJobForm({ ...jobForm, department: e.target.value })}
                      />
                    </div>
                  ) : (
                    <div className="relative">
                      <button 
                        onClick={() => setIsDeptDropdownOpen(!isDeptDropdownOpen)}
                        className="w-full px-4 py-3 bg-slate-100 border-none rounded-xl focus:ring-2 focus:ring-indigo-500 font-bold text-slate-800 text-left flex justify-between items-center outline-none ring-1 ring-slate-200 transition-all hover:ring-indigo-300"
                      >
                        {jobForm.department}
                        <ChevronDown size={18} className={`transition-transform duration-300 ${isDeptDropdownOpen ? 'rotate-180 text-indigo-500' : 'text-slate-400'}`} />
                      </button>

                      {isDeptDropdownOpen && (
                        <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden z-[80] animate-in fade-in slide-in-from-top-2 duration-300 max-h-[300px] flex flex-col">
                          <div className="overflow-y-auto flex-1 p-2 space-y-1">
                            {departments.map(dept => (
                              <div 
                                key={dept} 
                                onClick={() => { setJobForm({ ...jobForm, department: dept }); setIsDeptDropdownOpen(false); }}
                                className={`flex items-center justify-between px-3 py-2.5 rounded-xl cursor-pointer transition-all group ${jobForm.department === dept ? 'bg-indigo-50 text-indigo-700' : 'hover:bg-slate-50 text-slate-700'}`}
                              >
                                <span className="text-sm font-bold">{dept}</span>
                                <button 
                                  onClick={(e) => { e.stopPropagation(); handleDeleteDepartment(e, dept); }}
                                  className="p-1.5 opacity-0 group-hover:opacity-100 hover:bg-red-50 hover:text-red-500 rounded-lg text-slate-400 transition-all flex items-center justify-center"
                                  title="彻底删除部门"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            ))}
                          </div>
                          <div className="p-2 border-t border-slate-50 bg-slate-50/50">
                            <button 
                               onClick={() => setManualDeptInput(true)}
                               className="w-full flex items-center justify-center gap-2 py-2.5 bg-indigo-600 text-white font-bold text-xs hover:bg-indigo-700 rounded-xl transition-all shadow-md active:scale-95"
                            >
                               <PlusCircle size={14} /> 手动输入新部门
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-400 uppercase ml-1 tracking-wider">职位类型</label>
                <div className="grid grid-cols-2 gap-3 p-1 bg-slate-100 rounded-2xl border border-slate-200">
                  <button 
                    onClick={() => setJobForm({...jobForm, type: 'FULL_TIME'})}
                    className={`flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold transition-all ${jobForm.type === 'FULL_TIME' ? 'bg-white text-indigo-600 shadow-md ring-1 ring-indigo-100' : 'text-slate-500 hover:bg-slate-50'}`}
                  >
                    <UserSearch size={16}/> 正式 HC
                  </button>
                  <button 
                    onClick={() => setJobForm({...jobForm, type: 'INTERN'})}
                    className={`flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold transition-all ${jobForm.type === 'INTERN' ? 'bg-white text-emerald-600 shadow-md ring-1 ring-emerald-100' : 'text-slate-500 hover:bg-slate-50'}`}
                  >
                    <School size={16}/> 实习生
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-400 uppercase ml-1 tracking-wider">JD 职位详情</label>
                <textarea 
                  rows={4} 
                  className="w-full px-4 py-3 bg-slate-100 border-none rounded-xl focus:ring-2 focus:ring-indigo-500 text-slate-800 outline-none transition-all resize-none font-medium" 
                  placeholder="请输入详细的职位要求、岗位职责等信息..." 
                  value={jobForm.description} 
                  onChange={(e) => setJobForm({...jobForm, description: e.target.value})}
                ></textarea>
              </div>

              <div className="pt-4 flex gap-4">
                <button onClick={() => { setIsAddingJob(false); setManualDeptInput(false); setIsDeptDropdownOpen(false); }} className="flex-1 py-4 border border-slate-200 text-slate-600 font-bold rounded-xl hover:bg-slate-50 transition-colors">取消</button>
                <button 
                   onClick={handlePublishJob}
                   className="flex-1 py-4 bg-indigo-600 text-white font-bold rounded-xl shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all active:scale-[0.98]"
                >
                   发布招聘职位
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit Candidate Modal */}
      {isAddingCandidate && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[80] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in duration-200">
            <div className={`px-8 py-6 border-b flex justify-between items-center text-white ${candidateForm.isPoolDirect ? 'bg-cyan-600' : 'bg-indigo-600'}`}>
              <h2 className="text-xl font-bold flex items-center gap-2">
                {editingCandidateId ? <Settings2 /> : (candidateForm.isPoolDirect ? <Database /> : <Users />)}
                {editingCandidateId ? '编辑人才档案' : (candidateForm.isPoolDirect ? '录入储备人才' : '录入候选人')}
              </h2>
              <button onClick={() => { setIsAddingCandidate(false); setEditingCandidateId(null); }} className="hover:bg-white/20 p-1 rounded-full transition-colors"><X size={24} /></button>
            </div>
            <div className="p-8 space-y-6 max-h-[80vh] overflow-y-auto kanban-scrollbar">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1 relative">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">候选人姓名</label>
                  <div className="relative">
                    <input 
                      type="text" 
                      placeholder="请输入姓名" 
                      className="w-full px-4 py-2.5 bg-slate-100 border-none rounded-xl focus:ring-2 focus:ring-indigo-500 font-bold text-slate-800 outline-none" 
                      value={candidateForm.name}
                      onChange={(e) => setCandidateForm({...candidateForm, name: e.target.value})}
                    />
                    {isParsingResume && <div className="absolute right-3 top-1/2 -translate-y-1/2"><Loader2 size={16} className="text-indigo-400 animate-spin" /></div>}
                  </div>
                </div>
                {!candidateForm.isPoolDirect && (
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">投递职位</label>
                    <select 
                      value={candidateForm.jobId}
                      onChange={(e) => setCandidateForm({...candidateForm, jobId: e.target.value})}
                      className="w-full px-4 py-2.5 bg-slate-100 border-none rounded-xl focus:ring-2 focus:ring-indigo-500 font-bold text-slate-800 appearance-none outline-none"
                    >
                      <option value="">请选择职位...</option>
                      {jobs.filter(j => j.status === 'OPEN').map(j => <option key={j.id} value={j.id}>{j.title}</option>)}
                    </select>
                  </div>
                )}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">联系方式</label>
                  <div className="relative">
                    <input 
                      type="text" 
                      placeholder="电话/邮箱" 
                      className="w-full px-4 py-2.5 bg-slate-100 border-none rounded-xl focus:ring-2 focus:ring-indigo-500 font-bold text-slate-800 outline-none" 
                      value={candidateForm.contactInfo}
                      onChange={(e) => setCandidateForm({...candidateForm, contactInfo: e.target.value})}
                    />
                    {isParsingResume && <div className="absolute right-3 top-1/2 -translate-y-1/2"><Loader2 size={16} className="text-indigo-400 animate-spin" /></div>}
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">人才来源</label>
                  <select 
                    value={candidateForm.source}
                    onChange={(e) => setCandidateForm({...candidateForm, source: e.target.value})}
                    className="w-full px-4 py-2.5 bg-slate-100 border-none rounded-xl focus:ring-2 focus:ring-indigo-500 font-bold text-slate-800 appearance-none outline-none"
                  >
                    <option>BOSS直聘</option>
                    <option>智联招聘</option>
                    <option>猎聘</option>
                    <option>内推</option>
                    <option>LinkedIn</option>
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex justify-between items-center">
                   <span>{editingCandidateId ? '更新简历附件' : '附件简历 (PDF/Word)'}</span>
                   {isParsingResume && <span className="text-indigo-500 flex items-center gap-1 normal-case font-bold"><Sparkles size={12}/> 正在智能识别信息...</span>}
                </label>
                <div className="relative group/upload">
                  {candidateForm.resumeFile ? (
                    <div className="flex items-center justify-between p-4 bg-indigo-50 border-2 border-indigo-200 rounded-2xl animate-in zoom-in duration-200">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-indigo-100 text-indigo-600 rounded-lg">
                          <FileArchive size={20} />
                        </div>
                        <div className="flex flex-col">
                          <span className="text-sm font-bold text-slate-800 truncate max-w-[300px]">{candidateForm.resumeFile.name}</span>
                          <span className="text-[10px] text-slate-400">{(candidateForm.resumeFile.size / 1024 / 1024).toFixed(2)} MB</span>
                        </div>
                      </div>
                      <button 
                        onClick={() => setCandidateForm({...candidateForm, resumeFile: null})}
                        className="p-1.5 hover:bg-red-50 text-slate-400 hover:text-red-500 rounded-full transition-colors"
                      >
                        <X size={18} />
                      </button>
                    </div>
                  ) : (
                    <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-slate-200 rounded-2xl cursor-pointer hover:bg-slate-50 hover:border-indigo-300 transition-all group-active/upload:scale-[0.99]">
                      <div className="flex flex-col items-center justify-center pt-5 pb-6">
                        <FileUp className="w-8 h-8 mb-3 text-slate-300 group-hover/upload:text-indigo-400 transition-colors" />
                        <p className="mb-1 text-sm text-slate-500 font-medium">
                           {editingCandidateId ? '点击或拖拽上传新简历以覆盖' : '点击或拖拽上传简历'}
                        </p>
                        <p className="text-xs text-slate-400">支持 PDF, PNG, JPG (自动识别姓名/电话)</p>
                      </div>
                      <input 
                        type="file" 
                        className="hidden" 
                        accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg"
                        onChange={handleFileChange}
                      />
                    </label>
                  )}
                </div>
              </div>

              <div className="space-y-1">
                 <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                   {editingCandidateId ? '追加备注信息' : '备注信息'}
                 </label>
                 <textarea 
                    rows={3} 
                    className="w-full px-4 py-3 bg-slate-100 border-none rounded-xl focus:ring-2 focus:ring-indigo-500 text-slate-800 outline-none" 
                    placeholder={editingCandidateId ? "此处输入的文字将作为新的一条记录保存..." : "输入该人才的特点、历史反馈等..."}
                    value={candidateForm.notes}
                    onChange={(e) => setCandidateForm({...candidateForm, notes: e.target.value})}
                  ></textarea>
                  {editingCandidateId && (
                    <p className="text-[10px] text-slate-400 mt-1 italic">* 编辑模式下，新的备注会追加到历史记录顶部。</p>
                  )}
              </div>
              <div className="pt-4 flex gap-4">
                <button onClick={() => { setIsAddingCandidate(false); setEditingCandidateId(null); }} className="flex-1 py-3.5 border border-slate-200 text-slate-600 font-bold rounded-xl hover:bg-slate-50 transition-colors">取消</button>
                <button 
                  onClick={handleAddOrUpdateCandidate}
                  disabled={isParsingResume}
                  className={`flex-1 py-3.5 text-white font-bold rounded-xl shadow-lg transition-all active:scale-[0.98] disabled:opacity-50 ${candidateForm.isPoolDirect ? 'bg-cyan-600 hover:bg-cyan-700 shadow-cyan-100' : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-100'}`}
                >
                  {isParsingResume ? '正在处理...' : editingCandidateId ? '保存修改' : (candidateForm.isPoolDirect ? '存入储备库' : '确认录入')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;