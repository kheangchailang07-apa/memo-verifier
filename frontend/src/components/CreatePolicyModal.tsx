import React, { useState, useEffect } from 'react';
import { Policy, User, Department } from '../types';
import { BookOpen, X, PlusCircle, CheckCircle2, Sparkles } from 'lucide-react';
interface CreatePolicyModalProps {
  currentUser: User;
  departments: Department[];
  onClose: () => void;
  onCreatePolicy: (newPolicy: Policy) => void;
  initialPolicy?: Policy | null;
}
export const CreatePolicyModal: React.FC<CreatePolicyModalProps> = ({
  currentUser,
  departments,
  onClose,
  onCreatePolicy,
  initialPolicy = null,
}) => {
  const isEdit = Boolean(initialPolicy);
  const [title, setTitle] = useState('');
  const [code, setCode] = useState(`APA-POL-${new Date().getFullYear()}-01`);
  const [category, setCategory] = useState<Policy['category']>('IT & Security');
  const [departmentScope, setDepartmentScope] = useState('All Departments');
  const [version, setVersion] = useState('1.0');
  const [summary, setSummary] = useState('');
  const [sectionHeading, setSectionHeading] = useState('1. General Provisions & Compliance');
  const [sectionContent, setSectionContent] = useState('');
  const [tagsInput, setTagsInput] = useState('Policy, Governance');
  const [isMandatoryReading, setIsMandatoryReading] = useState(true);
  useEffect(() => {
    if (isEdit && initialPolicy) {
      setTitle(initialPolicy.title || '');
      setCode(initialPolicy.code || `POL-${Date.now().toString().slice(-4)}`);
      setCategory(initialPolicy.category);
      setDepartmentScope(initialPolicy.departmentScope || 'All Departments');
      setVersion(initialPolicy.version || '1.0');
      setSummary(initialPolicy.summary || '');
      setSectionHeading(
        (initialPolicy.sections && initialPolicy.sections[0]?.heading) ||
          '1. General Provisions & Compliance'
      );
      setSectionContent(
        (initialPolicy.sections && initialPolicy.sections[0]?.content) || ''
      );
      setTagsInput(Array.isArray(initialPolicy.tags) ? initialPolicy.tags.join(', ') : '');
      setIsMandatoryReading(Boolean(initialPolicy.isMandatoryReading));
    } else {
      setTitle('');
      setCode(`APA-POL-${new Date().getFullYear()}-01`);
      setCategory('IT & Security');
      setDepartmentScope('All Departments');
      setVersion('1.0');
      setSummary('');
      setSectionHeading('1. General Provisions & Compliance');
      setSectionContent('');
      setTagsInput('Policy, Governance');
      setIsMandatoryReading(true);
    }
  }, [isEdit, initialPolicy]);
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !sectionContent.trim()) return;
    const tags = tagsInput
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);
    const policyData: Policy = {
      id: isEdit && initialPolicy ? initialPolicy.id : `POL-${Date.now()}`,
      code: code.trim() || `POL-${Date.now().toString().slice(-4)}`,
      title: title.trim(),
      category,
      departmentScope,
      version: version.trim() || '1.0',
      lastUpdated: new Date().toISOString().slice(0, 10),
      effectiveDate: new Date().toISOString().slice(0, 10),
      summary: summary.trim() || title.trim(),
      tags: tags.length ? tags : ['Official', 'Policy'],
      isMandatoryReading,
      sections: [
        {
          id: 'sec-1',
          heading: sectionHeading.trim() || '1. General Provisions & Compliance',
          content: sectionContent.trim(),
        },
      ],
    };
    onCreatePolicy(policyData);
    onClose();
  };
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 sm:p-6 apa-rise-in">
      <div className="relative w-full max-w-2xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="p-2 rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-400">
              <BookOpen className="w-5 h-5" />
            </span>
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                Create Policy Article
              </h2>
              <p className="text-xs text-slate-500">
                Publish a new official company policy to the APA Handbook
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4 text-xs max-h-[calc(85vh-160px)] overflow-y-auto">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                Policy Title:
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Employee Code of Conduct & Workplace Standards"
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                Policy Code:
              </label>
              <input
                type="text"
                required
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="e.g. APA-POL-HR-01"
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono"
              />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                Category:
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as Policy['category'])}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs"
              >
                <option value="IT & Security">IT &amp; Security</option>
                <option value="Conduct & Ethics">Conduct &amp; Ethics</option>
                <option value="Leave & Attendance">Leave &amp; Attendance</option>
                <option value="Workplace & Remote">Workplace &amp; Remote</option>
                <option value="Compensation & Benefits">Compensation &amp; Benefits</option>
              </select>
            </div>
            <div>
              <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                Department Scope:
              </label>
              <select
                value={departmentScope}
                onChange={(e) => setDepartmentScope(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs"
              >
                <option value="All Departments">All Departments</option>
                {!['All Departments', ...departments.map((d) => d.name)].includes(departmentScope) && (
                  <option value={departmentScope}>{departmentScope}</option>
                )}
                {departments.map((d) => (
                  <option key={d.id} value={d.name}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                Version:
              </label>
              <input
                type="text"
                value={version}
                onChange={(e) => setVersion(e.target.value)}
                placeholder="e.g. 1.0"
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs"
              />
            </div>
          </div>
          <div>
            <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
              Executive Brief / Overview:
            </label>
            <input
              type="text"
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder="High level overview of what this policy entails..."
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs"
            />
          </div>
          <div>
            <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
              Section Heading:
            </label>
            <input
              type="text"
              value={sectionHeading}
              onChange={(e) => setSectionHeading(e.target.value)}
              placeholder="e.g. 1. Core Operating Principles"
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs"
            />
          </div>
          <div>
            <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
              Policy Content &amp; Rules:
            </label>
            <textarea
              required
              rows={5}
              value={sectionContent}
              onChange={(e) => setSectionContent(e.target.value)}
              placeholder="Write the full policy content, employee duties, and compliance rules..."
              className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs leading-relaxed font-sans"
            />
          </div>
          <div>
            <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
              Tags (comma separated):
            </label>
            <input
              type="text"
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              placeholder="Conduct, Safety, Compliance"
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs"
            />
          </div>
          <label className="flex items-center gap-2.5 p-3 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-900 cursor-pointer">
            <input
              type="checkbox"
              checked={isMandatoryReading}
              onChange={(e) => setIsMandatoryReading(e.target.checked)}
              className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
            />
            <span className="text-xs text-indigo-950 dark:text-indigo-200">
              <strong>Mandatory Reading:</strong> Require affected personnel to review this document.
            </span>
          </label>
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-all shadow-md shadow-indigo-500/20"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              <span>{isEdit ? 'Save Changes' : 'Publish Policy Article'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};