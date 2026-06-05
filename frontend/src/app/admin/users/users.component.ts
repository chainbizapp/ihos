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
  templateUrl: './users.component.html',
  styleUrl: './users.component.scss'
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
