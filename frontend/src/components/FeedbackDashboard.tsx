'use client';

import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { TrendingUp, TrendingDown, MessageSquare, Mail, Star, Users } from 'lucide-react';
import api from '@/lib/api';

interface FeedbackStats {
  summary: {
    total_feedback: number;
    average_rating: number;
    positive_feedback: number;
    negative_feedback: number;
    feedback_rate: number;
  };
  by_type: Array<{
    feedback_type: string;
    count: number;
    avg_rating: number;
  }>;
  email_metrics: {
    total_email_feedback: number;
    average_rating: number;
    modification_rate: number;
    common_issues: Record<string, number>;
  };
  daily_stats: Array<{
    date: string;
    count: number;
    avg_rating: number;
    positive: number;
    negative: number;
  }>;
  recent_samples: {
    positive: Array<{
      rating: number;
      feedback: string;
      type: string;
      date: string;
    }>;
    negative: Array<{
      rating: number;
      feedback: string;
      type: string;
      date: string;
    }>;
  };
}

const FeedbackDashboard: React.FC = () => {
  const [stats, setStats] = useState<FeedbackStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState(30);

  useEffect(() => {
    fetchStats();
  }, [timeRange]);

  const fetchStats = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/api/feedback/analytics/?days=${timeRange}`);
      setStats(response.data);
      setError(null);
    } catch (err) {
      setError('Failed to load feedback analytics');
      console.error('Error fetching feedback stats:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6 bg-cream dark:bg-gray-900 rounded-lg shadow">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/4 mb-4"></div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-20 bg-gray-200 dark:bg-gray-700 rounded"></div>
            ))}
          </div>
          <div className="h-64 bg-gray-200 dark:bg-gray-700 rounded"></div>
        </div>
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="p-6 bg-cream dark:bg-gray-900 rounded-lg shadow">
        <div className="text-center text-red-600 dark:text-red-400">
          {error || 'No feedback data available'}
        </div>
      </div>
    );
  }

  const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'];

  const StatCard = ({ title, value, icon: Icon, trend, color = 'blue' }: {
    title: string;
    value: string | number;
    icon: React.ElementType;
    trend?: 'up' | 'down';
    color?: string;
  }) => (
    <div className="bg-cream dark:bg-gray-800 p-4 rounded-lg shadow border border-gray-200 dark:border-gray-700">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-600 dark:text-gray-400">{title}</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{value}</p>
        </div>
        <div className={`p-2 rounded-lg bg-${color}-100 dark:bg-${color}-900/20`}>
          <Icon className={`h-6 w-6 text-${color}-600 dark:text-${color}-400`} />
        </div>
      </div>
      {trend && (
        <div className="mt-2 flex items-center">
          {trend === 'up' ? (
            <TrendingUp className="h-4 w-4 text-green-500 mr-1" />
          ) : (
            <TrendingDown className="h-4 w-4 text-red-500 mr-1" />
          )}
          <span className={`text-sm ${trend === 'up' ? 'text-green-600' : 'text-red-600'}`}>
            {trend === 'up' ? 'Improving' : 'Declining'}
          </span>
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          AI Feedback Analytics
        </h2>
        <select
          value={timeRange}
          onChange={(e) => setTimeRange(Number(e.target.value))}
          className="rounded-lg border border-gray-300 dark:border-gray-600 bg-cream dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        >
          <option value={7}>Last 7 days</option>
          <option value={30}>Last 30 days</option>
          <option value={90}>Last 90 days</option>
        </select>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard
          title="Total Feedback"
          value={stats.summary.total_feedback}
          icon={MessageSquare}
          color="blue"
        />
        <StatCard
          title="Average Rating"
          value={`${stats.summary.average_rating}/5`}
          icon={Star}
          color="yellow"
        />
        <StatCard
          title="Positive Feedback"
          value={stats.summary.positive_feedback}
          icon={TrendingUp}
          color="green"
        />
        <StatCard
          title="Feedback Rate"
          value={`${stats.summary.feedback_rate}%`}
          icon={Users}
          color="purple"
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Daily Feedback Trend */}
        <div className="bg-cream dark:bg-gray-800 p-6 rounded-lg shadow border border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
            Daily Feedback Trend
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={stats.daily_stats}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="date" 
                tick={{ fontSize: 12 }}
                tickFormatter={(value) => new Date(value).toLocaleDateString()}
              />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip 
                labelFormatter={(value: any) => new Date(value).toLocaleDateString()}
                formatter={(value: any, name: any) => [value, name === 'count' ? 'Feedback Count' : 'Avg Rating']}
              />
              <Bar dataKey="count" fill="#3B82F6" name="count" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Feedback by Type */}
        <div className="bg-cream dark:bg-gray-800 p-6 rounded-lg shadow border border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
            Feedback by Type
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={stats.by_type}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ feedback_type, count }: any) => `${feedback_type}: ${count}`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="count"
              >
                {stats.by_type.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Email Metrics */}
      {stats.email_metrics.total_email_feedback > 0 && (
        <div className="bg-cream dark:bg-gray-800 p-6 rounded-lg shadow border border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
            Email Generation Metrics
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <StatCard
              title="Email Feedback"
              value={stats.email_metrics.total_email_feedback}
              icon={Mail}
              color="blue"
            />
            <StatCard
              title="Email Rating"
              value={`${stats.email_metrics.average_rating}/5`}
              icon={Star}
              color="yellow"
            />
            <StatCard
              title="Modification Rate"
              value={`${stats.email_metrics.modification_rate}%`}
              icon={TrendingUp}
              color="orange"
            />
          </div>
          
          {/* Common Issues */}
          <div>
            <h4 className="text-md font-medium text-gray-900 dark:text-gray-100 mb-2">
              Common Issues
            </h4>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
              {Object.entries(stats.email_metrics.common_issues).map(([issue, count]) => (
                <div key={issue} className="text-center p-2 bg-gray-50 dark:bg-gray-700 rounded">
                  <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    {issue.replace(/_/g, ' ')}
                  </div>
                  <div className="text-lg font-bold text-blue-600 dark:text-blue-400">
                    {count}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Recent Feedback Samples */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Positive Feedback */}
        <div className="bg-cream dark:bg-gray-800 p-6 rounded-lg shadow border border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-green-500" />
            Recent Positive Feedback
          </h3>
          <div className="space-y-3">
            {stats.recent_samples.positive.slice(0, 3).map((feedback, index) => (
              <div key={index} className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium text-green-800 dark:text-green-200">
                    {feedback.type} - {feedback.rating}/5 ⭐
                  </span>
                  <span className="text-xs text-green-600 dark:text-green-400">
                    {new Date(feedback.date).toLocaleDateString()}
                  </span>
                </div>
                <p className="text-sm text-green-700 dark:text-green-300">
                  {feedback.feedback}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Negative Feedback */}
        <div className="bg-cream dark:bg-gray-800 p-6 rounded-lg shadow border border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
            <TrendingDown className="h-5 w-5 text-red-500" />
            Recent Negative Feedback
          </h3>
          <div className="space-y-3">
            {stats.recent_samples.negative.slice(0, 3).map((feedback, index) => (
              <div key={index} className="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium text-red-800 dark:text-red-200">
                    {feedback.type} - {feedback.rating}/5 ⭐
                  </span>
                  <span className="text-xs text-red-600 dark:text-red-400">
                    {new Date(feedback.date).toLocaleDateString()}
                  </span>
                </div>
                <p className="text-sm text-red-700 dark:text-red-300">
                  {feedback.feedback}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default FeedbackDashboard;