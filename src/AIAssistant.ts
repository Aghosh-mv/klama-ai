import { Platform } from 'react-native';

export interface AIResponse {
  text: string;
  confidence: number;
  toolsUsed?: string[];
}

export interface AgentMemory {
  key: string;
  value: string;
  timestamp: number;
}

export class AIAssistant {
  private apiKey: string = '';
  private isProcessing: boolean = false;
  private memory: AgentMemory[] = [];
  private readonly MAX_MEMORY_ENTRIES = 50;

  setAPIKey(key: string): void {
    this.apiKey = key;
  }

  getMemory(key: string): string | undefined {
    const entry = this.memory.find(m => m.key === key);
    return entry?.value;
  }

  setMemory(key: string, value: string): void {
    // Remove if exists
    this.memory = this.memory.filter(m => m.key !== key);
    // Add new entry
    this.memory.push({ key, value, timestamp: Date.now() });
    // Trim to max entries
    if (this.memory.length > this.MAX_MEMORY_ENTRIES) {
      this.memory = this.memory.slice(-this.MAX_MEMORY_ENTRIES);
    }
  }

  clearMemory(): void {
    this.memory = [];
  }

  async respond(text: string, context?: { conversationHistory?: string[] }): Promise<AIResponse | null> {
    if (this.isProcessing || !this.apiKey) return null;

    this.isProcessing = true;
    try {
      // Build the full prompt with context and memory
      const memoryContext = this.memory
        .slice(-5) // Last 5 memories
        .map(m => `${m.key}: ${m.value}`)
        .join('\n');

      const conversationContext = context?.conversationHistory
        ? context.conversationHistory.slice(-3).join('\n')
        : '';

      const fullPrompt = `
${memoryContext}

Conversation History:
${conversationContext}

User: ${text}

Assistant:`;

      const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=' + this.apiKey, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: fullPrompt }] }],
          generationConfig: {
            temperature: 0.7,
            topP: 0.95,
            topK: 40,
            maxOutputTokens: 1024,
          },
        }),
      });

      const data = await response.json();
      
      if (data.candidates && data.candidates[0]?.content?.parts?.[0]?.text) {
        const assistantText = data.candidates[0].content.parts[0].text;
        
        // Try to extract any memory updates or tool usage from the response
        this.processAssistantResponse(assistantText);
        
        return {
          text: assistantText,
          confidence: 0.95,
          toolsUsed: this.getUsedTools(),
        };
      }

      return null;
    } catch (error) {
      console.error('AI response error:', error);
      return null;
    } finally {
      this.isProcessing = false;
    }
  }

  private usedTools: Set<string> = new Set();

  private getUsedTools(): string[] {
    return Array.from(this.usedTools);
  }

  private processAssistantResponse(response: string): void {
    // Look for memory update patterns
    const memoryMatch = response.match(/MEMORY:\[(.*?)\]\[(.*?)\]/);
    if (memoryMatch) {
      const [, key, value] = memoryMatch.slice(1);
      this.setMemory(key.trim(), value.trim());
    }

    // Look for tool usage patterns
    const toolMatches = response.match(/TOOL:(\w+)/g);
    if (toolMatches) {
      toolMatches.forEach(t => this.usedTools.add(t.replace('TOOL:', '')));
    }

    // Look for task completion patterns
    if (response.toLowerCase().includes('task completed') || response.toLowerCase().includes('done')) {
      this.usedTools.add('task_manager');
    }
  }

  async scheduleNotification(title: string, body: string, seconds: number): Promise<void> {
    if (Platform.OS === 'android') {
      await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body,
        },
        trigger: {
          seconds,
        },
      });
    } else {
      await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body,
        },
        trigger: {
          seconds: 1,
        },
      });
    }
  }

  // Agentic: Plan and execute tasks
  async planAndExecute(task: string): Promise<{
    steps: string[];
    completed: boolean;
    result?: string;
  }> {
    // This is a basic task planning agent
    const plan = await this.planTask(task);
    
    const results: string[] = [];
    
    for (const step of plan.steps) {
      const response = await this.respond(step);
      if (response?.text) {
        results.push(response.text);
      }
    }
    
    const finalResult = results.join('\n');
    
    return {
      steps: plan.steps,
      completed: plan.steps.length > 0,
      result: finalResult,
    };
  }

  private async planTask(task: string): Promise<{ steps: string[] }> {
    // Simple task decomposition
    const lowerTask = task.toLowerCase();
    
    if (lowerTask.includes('remind me') || lowerTask.includes('set reminder')) {
      const match = task.match(/remind me to (.+?)(?: in| after)? (\w+)?/i);
      if (match) {
        const reminder = match[1].trim();
        const time = match[2] || '1 hour';
        this.setMemory('pending_reminder', reminder);
        this.setMemory('reminder_time', time);
        return {
          steps: [`Reminder set for: ${reminder} (in ${time})`],
        };
      }
    }
    
    if (lowerTask.includes('calculate') || lowerTask.includes('math')) {
      const mathMatch = task.match(/calculate (.+)/i);
      if (mathMatch) {
        const expr = mathMatch[1];
        try {
          const result = this.evaluateExpression(expr);
          return {
            steps: [`Calculation: ${expr} = ${result}`],
          };
        } catch {
          return {
            steps: [`Unable to calculate: ${expr}`],
          };
        }
      }
    }
    
    // Default: single step asking AI
    return {
      steps: [task],
    };
  }

  private evaluateExpression(expr: string): number {
    // Simple safe evaluation
    const sanitized = expr.replace(/[^0-9+\-*/().% ]/g, '');
    return eval(sanitized);
  }
}

export const aiAssistant = new AIAssistant();