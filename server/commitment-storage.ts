// NoSQL storage for commitment data
import { randomUUID } from "crypto";

export interface CommitmentDocument {
  id: string;
  commitmentId: string;
  investorLoanNumber: string;
  agency: string; // fannie_mae, freddie_mac, ginnie_mae
  status: string; // staged, processed, active, expired
  data: any; // Full commitment data
  createdAt: number;
  updatedAt: number;
  metadata: {
    source: string;
    stagedAt: string;
    processedAt?: string;
    expiresAt?: string;
  };
}

export class CommitmentNoSQLStorage {
  private commitments: Map<string, CommitmentDocument> = new Map();
  private indexByCommitmentId: Map<string, string> = new Map();
  private indexByLoanNumber: Map<string, string> = new Map();

  // Store a commitment document
  async storeCommitment(commitmentData: any, agency: string = "unknown"): Promise<CommitmentDocument> {
    const commitment: CommitmentDocument = {
      id: randomUUID(),
      commitmentId: commitmentData.commitmentId || commitmentData.commitmentData?.commitmentId,
      investorLoanNumber: commitmentData.investorLoanNumber || commitmentData.commitmentData?.investorLoanNumber,
      agency,
      status: "staged",
      data: commitmentData,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      metadata: {
        source: "commitment_upload",
        stagedAt: new Date().toISOString(),
        expiresAt: commitmentData.expirationDate || commitmentData.commitmentData?.expirationDate
      }
    };

    // Store with multiple indexes
    this.commitments.set(commitment.id, commitment);
    this.indexByCommitmentId.set(commitment.commitmentId, commitment.id);
    this.indexByLoanNumber.set(commitment.investorLoanNumber, commitment.id);

    return commitment;
  }

  // Retrieve by commitment ID
  async getByCommitmentId(commitmentId: string): Promise<CommitmentDocument | null> {
    const id = this.indexByCommitmentId.get(commitmentId);
    return id ? this.commitments.get(id) || null : null;
  }

  // Retrieve by loan number
  async getByLoanNumber(loanNumber: string): Promise<CommitmentDocument | null> {
    const id = this.indexByLoanNumber.get(loanNumber);
    return id ? this.commitments.get(id) || null : null;
  }

  // Get all commitments
  async getAllCommitments(): Promise<CommitmentDocument[]> {
    return Array.from(this.commitments.values());
  }

  // Get commitments by status
  async getByStatus(status: string): Promise<CommitmentDocument[]> {
    return Array.from(this.commitments.values())
      .filter(commitment => commitment.status === status);
  }

  // Get commitments by agency
  async getByAgency(agency: string): Promise<CommitmentDocument[]> {
    return Array.from(this.commitments.values())
      .filter(commitment => commitment.agency === agency);
  }

  // Update commitment status
  async updateStatus(id: string, status: string, metadata?: any): Promise<CommitmentDocument | null> {
    const commitment = this.commitments.get(id);
    if (!commitment) return null;

    commitment.status = status;
    commitment.updatedAt = Date.now();
    
    if (metadata) {
      commitment.metadata = { ...commitment.metadata, ...metadata };
    }

    if (status === "processed") {
      commitment.metadata.processedAt = new Date().toISOString();
    }

    this.commitments.set(id, commitment);
    return commitment;
  }

  // Query commitments with filters
  async queryCommitments(filters: {
    status?: string;
    agency?: string;
    startDate?: number;
    endDate?: number;
  }): Promise<CommitmentDocument[]> {
    let results = Array.from(this.commitments.values());

    if (filters.status) {
      results = results.filter(c => c.status === filters.status);
    }

    if (filters.agency) {
      results = results.filter(c => c.agency === filters.agency);
    }

    if (filters.startDate) {
      results = results.filter(c => c.createdAt >= filters.startDate!);
    }

    if (filters.endDate) {
      results = results.filter(c => c.createdAt <= filters.endDate!);
    }

    return results.sort((a, b) => b.createdAt - a.createdAt);
  }

  // Delete commitment
  async deleteCommitment(id: string): Promise<boolean> {
    const commitment = this.commitments.get(id);
    if (!commitment) return false;

    this.commitments.delete(id);
    this.indexByCommitmentId.delete(commitment.commitmentId);
    this.indexByLoanNumber.delete(commitment.investorLoanNumber);

    return true;
  }

  // Get summary statistics
  async getSummary(): Promise<{
    total: number;
    byStatus: { [status: string]: number };
    byAgency: { [agency: string]: number };
    recent: CommitmentDocument[];
  }> {
    const all = Array.from(this.commitments.values());
    
    const byStatus = all.reduce((acc, commitment) => {
      acc[commitment.status] = (acc[commitment.status] || 0) + 1;
      return acc;
    }, {} as { [key: string]: number });

    const byAgency = all.reduce((acc, commitment) => {
      acc[commitment.agency] = (acc[commitment.agency] || 0) + 1;
      return acc;
    }, {} as { [key: string]: number });

    const recent = all
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, 5);

    return {
      total: all.length,
      byStatus,
      byAgency,
      recent
    };
  }
}

// Export singleton instance
export const commitmentStorage = new CommitmentNoSQLStorage();