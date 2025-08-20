/**
 * Agent Registry
 * Centralized registry for managing LangChain agents in PaperMind
 */

import { BaseAgent } from './base';

export class AgentRegistry {
  private static agents = new Map<string, BaseAgent<any, any>>();

  /**
   * Register an agent in the registry
   */
  static registerAgent(agent: BaseAgent<any, any>): void {
    this.agents.set(agent.name, agent);
  }

  /**
   * Get an agent by name
   */
  static getAgent<T extends BaseAgent<any, any>>(name: string): T | null {
    return (this.agents.get(name) as T) || null;
  }

  /**
   * Check if an agent is registered
   */
  static hasAgent(name: string): boolean {
    return this.agents.has(name);
  }

  /**
   * Get all registered agent names
   */
  static getAgentNames(): string[] {
    return Array.from(this.agents.keys());
  }

  /**
   * Clear all registered agents
   */
  static clear(): void {
    this.agents.clear();
  }

  /**
   * Get registry statistics
   */
  static getStats(): {
    totalAgents: number;
    agentNames: string[];
  } {
    return {
      totalAgents: this.agents.size,
      agentNames: this.getAgentNames(),
    };
  }
}