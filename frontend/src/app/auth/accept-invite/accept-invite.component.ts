import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators, AbstractControl } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../../core/auth.service';
import { environment } from '../../../environments/environment';

function passwordMatchValidator(control: AbstractControl) {
  const password = control.get('password');
  const confirm = control.get('confirmPassword');
  if (password && confirm && password.value !== confirm.value) {
    confirm.setErrors({ mismatch: true });
  } else {
    confirm?.setErrors(null);
  }
  return null;
}

@Component({
  selector: 'app-accept-invite',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatProgressSpinnerModule,
  ],
  template: `
    <div class="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <mat-card class="w-full max-w-md">
        <mat-card-header>
          <mat-card-title class="text-2xl font-bold text-center w-full">Set Your Password</mat-card-title>
        </mat-card-header>
        <mat-card-content class="mt-4">
          <form [formGroup]="form" (ngSubmit)="onSubmit()" class="flex flex-col gap-4">
            <mat-form-field>
              <mat-label>New Password</mat-label>
              <input matInput type="password" formControlName="password" autocomplete="new-password" />
              @if (form.get('password')?.hasError('required') && form.get('password')?.touched) {
                <mat-error>Password is required</mat-error>
              }
              @if (form.get('password')?.hasError('minlength')) {
                <mat-error>Password must be at least 8 characters</mat-error>
              }
            </mat-form-field>

            <mat-form-field>
              <mat-label>Confirm Password</mat-label>
              <input matInput type="password" formControlName="confirmPassword" autocomplete="new-password" />
              @if (form.get('confirmPassword')?.hasError('mismatch')) {
                <mat-error>Passwords do not match</mat-error>
              }
            </mat-form-field>

            @if (errorMessage()) {
              <div class="text-red-600 text-sm p-2 bg-red-50 rounded">{{ errorMessage() }}</div>
            }

            <button mat-raised-button color="primary" type="submit" [disabled]="loading()">
              @if (loading()) {
                <mat-spinner diameter="20" class="inline-block mr-2" />
              }
              Activate Account
            </button>
          </form>
        </mat-card-content>
      </mat-card>
    </div>
  `
})
export class AcceptInviteComponent implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);

  readonly form = this.fb.group({
    password: ['', [Validators.required, Validators.minLength(8)]],
    confirmPassword: ['', Validators.required],
  }, { validators: passwordMatchValidator });

  readonly loading = signal(false);
  readonly errorMessage = signal('');
  private token = '';

  ngOnInit(): void {
    this.token = this.route.snapshot.queryParamMap.get('token') ?? '';
    if (!this.token) {
      this.errorMessage.set('Invalid or missing invite token.');
    }
  }

  async onSubmit(): Promise<void> {
    if (this.form.invalid || !this.token) {
      this.form.markAllAsTouched();
      return;
    }

    this.loading.set(true);
    this.errorMessage.set('');

    try {
      const res = await firstValueFrom(
        this.http.post<{ accessToken: string; user: any }>(
          `${environment.apiUrl}/auth/invite/accept`,
          {
            token: this.token,
            password: this.form.value.password,
            confirmPassword: this.form.value.confirmPassword,
          }
        )
      );
      await this.router.navigate(['/search']);
    } catch (err: any) {
      this.errorMessage.set(err?.error?.message ?? 'Failed to accept invite. The token may have expired.');
    } finally {
      this.loading.set(false);
    }
  }
}
