import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatSnackBarModule, MatSnackBar } from '@angular/material/snack-bar';
import { MatChipsModule } from '@angular/material/chips';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';

interface User {
  id: string;
  email: string;
  fullName: string;
  role: string;
  status: string;
  createdAt: string;
}

interface PagedResult {
  items: User[];
  totalCount: number;
  page: number;
  pageSize: number;
}

@Component({
  selector: 'app-users',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatTableModule,
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatPaginatorModule,
    MatSnackBarModule,
    MatChipsModule,
  ],
  template: `
    <div class="p-6">
      <div class="flex justify-between items-center mb-6">
        <h1 class="text-2xl font-bold">User Management</h1>
        <button mat-raised-button color="primary" (click)="openInviteDialog()">
          Invite User
        </button>
      </div>

      <table mat-table [dataSource]="users()" class="w-full shadow-sm">
        <ng-container matColumnDef="fullName">
          <th mat-header-cell *matHeaderCellDef>Name</th>
          <td mat-cell *matCellDef="let u">{{ u.fullName }}</td>
        </ng-container>
        <ng-container matColumnDef="email">
          <th mat-header-cell *matHeaderCellDef>Email</th>
          <td mat-cell *matCellDef="let u">{{ u.email }}</td>
        </ng-container>
        <ng-container matColumnDef="role">
          <th mat-header-cell *matHeaderCellDef>Role</th>
          <td mat-cell *matCellDef="let u">
            <mat-chip>{{ u.role }}</mat-chip>
          </td>
        </ng-container>
        <ng-container matColumnDef="status">
          <th mat-header-cell *matHeaderCellDef>Status</th>
          <td mat-cell *matCellDef="let u">
            <mat-chip [class]="'status-' + u.status.toLowerCase()">{{ u.status }}</mat-chip>
          </td>
        </ng-container>
        <ng-container matColumnDef="actions">
          <th mat-header-cell *matHeaderCellDef>Actions</th>
          <td mat-cell *matCellDef="let u">
            <button mat-button color="warn" (click)="deactivate(u)" [disabled]="u.status === 'Inactive'">
              Deactivate
            </button>
          </td>
        </ng-container>

        <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
        <tr mat-row *matRowDef="let row; columns: displayedColumns;"></tr>
      </table>

      <mat-paginator
        [length]="totalCount()"
        [pageSize]="pageSize"
        [pageSizeOptions]="[20, 50]"
        (page)="onPage($event)">
      </mat-paginator>
    </div>

    @if (showInviteDialog()) {
      <div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div class="bg-white rounded-lg p-6 w-full max-w-md shadow-xl">
          <h2 class="text-xl font-bold mb-4">Invite User</h2>
          <form [formGroup]="inviteForm" (ngSubmit)="submitInvite()" class="flex flex-col gap-4">
            <mat-form-field>
              <mat-label>Email</mat-label>
              <input matInput type="email" formControlName="email" />
            </mat-form-field>
            <mat-form-field>
              <mat-label>Full Name</mat-label>
              <input matInput formControlName="fullName" />
            </mat-form-field>
            <mat-form-field>
              <mat-label>Role</mat-label>
              <mat-select formControlName="role">
                <mat-option value="Staff">Staff</mat-option>
                <mat-option value="SeniorStaff">Senior Staff</mat-option>
                <mat-option value="Manager">Manager</mat-option>
                <mat-option value="Admin">Admin</mat-option>
              </mat-select>
            </mat-form-field>
            @if (inviteError()) {
              <div class="text-red-600 text-sm">{{ inviteError() }}</div>
            }
            <div class="flex gap-2 justify-end">
              <button mat-button type="button" (click)="showInviteDialog.set(false)">Cancel</button>
              <button mat-raised-button color="primary" type="submit">Send Invite</button>
            </div>
          </form>
        </div>
      </div>
    }
  `
})
export class UsersComponent implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly snackBar = inject(MatSnackBar);
  private readonly fb = inject(FormBuilder);

  readonly displayedColumns = ['fullName', 'email', 'role', 'status', 'actions'];
  readonly users = signal<User[]>([]);
  readonly totalCount = signal(0);
  readonly showInviteDialog = signal(false);
  readonly inviteError = signal('');

  readonly pageSize = 20;
  private currentPage = 1;

  readonly inviteForm = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    fullName: ['', Validators.required],
    role: ['Staff', Validators.required],
  });

  ngOnInit(): void {
    this.loadUsers();
  }

  async loadUsers(): Promise<void> {
    const res = await firstValueFrom(
      this.http.get<PagedResult>(
        `${environment.apiUrl}/users?page=${this.currentPage}&pageSize=${this.pageSize}`
      )
    );
    this.users.set(res.items);
    this.totalCount.set(res.totalCount);
  }

  openInviteDialog(): void {
    this.inviteForm.reset({ role: 'Staff' });
    this.inviteError.set('');
    this.showInviteDialog.set(true);
  }

  async submitInvite(): Promise<void> {
    if (this.inviteForm.invalid) return;

    try {
      await firstValueFrom(
        this.http.post(`${environment.apiUrl}/users/invite`, this.inviteForm.value)
      );
      this.showInviteDialog.set(false);
      this.snackBar.open('Invite sent successfully', 'Close', { duration: 3000 });
      await this.loadUsers();
    } catch (err: any) {
      this.inviteError.set(err?.error?.message ?? 'Failed to send invite.');
    }
  }

  async deactivate(user: User): Promise<void> {
    try {
      await firstValueFrom(
        this.http.put(`${environment.apiUrl}/users/${user.id}/status`, { status: 'Inactive' })
      );
      this.snackBar.open('User deactivated', 'Close', { duration: 3000 });
      await this.loadUsers();
    } catch {
      this.snackBar.open('Failed to deactivate user', 'Close', { duration: 3000 });
    }
  }

  onPage(event: PageEvent): void {
    this.currentPage = event.pageIndex + 1;
    this.loadUsers();
  }
}
