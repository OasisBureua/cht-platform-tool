import { Bot } from 'lucide-react';

export default function ChatBot() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900">ChatBot</h1>
        <p className="text-sm text-gray-600">AI assistance for your healthcare content questions</p>
      </div>
      <div className="flex flex-col items-center justify-center py-16 rounded-2xl border border-gray-200 bg-gray-50">
        <Bot className="h-16 w-16 text-gray-400 mb-4" />
        <p className="text-gray-600 font-medium">Coming soon</p>
        <p className="text-sm text-gray-500 mt-1">ChatBot feature is under development</p>
      </div>
    </div>
  );
}
