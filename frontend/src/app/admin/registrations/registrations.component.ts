import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormsModule, FormBuilder } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSnackBarModule, MatSnackBar } from '@angular/material/snack-bar';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';

interface PendingUser {
  id: string;
  email: string;
  fullName: string;
  createdAt: string;
}

@Component({
  selector: 'app-registrations',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    FormsModule,
    MatTableModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatSnackBarModule,
  ],
  template: `
    <div class="p-6">
      <h1 class="text-2xl font-bold mb-6">Pending Registrations</h1>

      @if (users().length === 0) {
        <p class="text-gray-500">No pending registrations.</p>
      } @else {
        <table mat-table [dataSource]="users()" class="w-full shadow-sm">
          <ng-container matColumnDef="fullName">
            <th mat-header-cell *matHeaderCellDef>Name</th>
            <td mat-cell *matCellDef="let u">{{ u.fullName }}</td>
          </ng-container>
          <ng-container matColumnDef="email">
            <th mat-header-cell *matHeaderCellDef>Email</th>
            <td mat-cell *matCellDef="let u">{{ u.email }}</td>
          </ng-container>
          <ng-container matColumnDef="createdAt">
            <th mat-header-cell *matHeaderCellDef>Requested</th>
            <td mat-cell *matCellDef="let u">{{ u.createdAt | date:'medium' }}</td>
          </ng-container>
          <ng-container matColumnDef="actions">
            <th mat-header-cell *matHeaderCellDef>Actions</th>
            <td mat-cell *matCellDef="let u">
              <button mat-button color="primary" (click)="approve(u)">Approve</button>
              <button mat-button color="warn" (click)="openRejectDialog(u)">Reject</button>
            </td>
          </ng-container>

          <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
          <tr mat-row *matRowDef="let row; columns: displayedColumns;"></tr>
        </table>
      }
    </div>

    @if (rejectingUser()) {
      <div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div class="bg-white rounded-lg p-6 w-full max-w-md shadow-xl">
          <h2 class="text-xl font-bold mb-4">Reject Registration</h2>
          <p class="text-gray-600 mb-4">Rejecting: <strong>{{ rejectingUser()?.fullName }}</strong></p>
          <mat-form-field class="w-full">
            <mat-label>Reason (optional)</mat-label>
            <input matInput [(ngModel)]="rejectReason" name="reason" />
          </mat-form-field>
          <div class="flex gap-2 justify-end mt-4">
            <button mat-button (click)="rejectingUser.set(null)">Cancel</button>
            <button mat-raised-button color="warn" (click)="submitReject()">Reject</button>
          </div>
        </div>
      </div>
    }
  `
})
export class RegistrationsComponent implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly snackBar = inject(MatSnackBar);

  readonly displayedColumns = ['fullName', 'email', 'createdAt', 'actions'];
  readonly users = signal<PendingUser[]>([]);
  readonly rejectingUser = signal<PendingUser | null>(null);
  rejectReason = '';

  ngOnInit(): void {
    this.load();
  }

  async load(): Promise<void> {
    const res = await firstValueFrom(
      this.http.get<PendingUser[]>(`${environment.apiUrl}/users/registrations/pending`)
    );
    this.users.set(res);
  }

  async approve(user: PendingUser): Promise<void> {
    try {
      await firstValueFrom(
        this.http.put(`${environment.apiUrl}/users/registrations/${user.id}/approve`, {})
      );
      this.snackBar.open(`${user.fullName} approved`, 'Close', { duration: 3000 });
      await this.load();
    } catch {
      this.snackBar.open('Approval failed', 'Close', { duration: 3000 });
    }
  }

  openRejectDialog(user: PendingUser): void {
    this.rejectReason = '';
    this.rejectingUser.set(user);
  }

  async submitReject(): Promise<void> {
    const user = this.rejectingUser();
    if (!user) return;

    try {
      await firstValueFrom(
        this.http.put(
          `${environment.apiUrl}/users/registrations/${user.id}/reject`,
          { reason: this.rejectReason || null }
        )
      );
      this.snackBar.open(`${user.fullName} rejected`, 'Close', { duration: 3000 });
      this.rejectingUser.set(null);
      await this.load();
    } catch {
      this.snackBar.open('Rejection failed', 'Close', { duration: 3000 });
    }
  }
}
