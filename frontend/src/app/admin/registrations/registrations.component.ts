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
  templateUrl: './registrations.component.html',
  styleUrl: './registrations.component.scss'
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
