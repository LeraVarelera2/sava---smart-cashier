<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\ProductController;
use App\Http\Controllers\TransactionController;
use App\Http\Controllers\DashboardController;
use App\Http\Controllers\BusinessProfileController;
use App\Http\Controllers\MlController;

// Public routes
Route::post('/login', [AuthController::class, 'login']);

// Protected routes
Route::middleware('auth:sanctum')->group(function () {
    // Auth
    Route::post('/logout', [AuthController::class, 'logout']);
    Route::get('/me', [AuthController::class, 'me']);

    // Products
    Route::get('/products', [ProductController::class, 'index']);
    Route::post('/products', [ProductController::class, 'store']);
    Route::put('/products/{id}', [ProductController::class, 'update']);
    Route::delete('/products/{id}', [ProductController::class, 'destroy']);
    Route::post('/products/{id}/variants', [ProductController::class, 'storeVariant']);
    Route::put('/variants/{id}', [ProductController::class, 'updateVariant']);
    Route::delete('/variants/{id}', [ProductController::class, 'destroyVariant']);

    // Transactions
    Route::post('/transactions', [TransactionController::class, 'store']);
    Route::get('/transactions', [TransactionController::class, 'index']);

    // Reports
    Route::get('/reports/sales', [\App\Http\Controllers\ReportController::class, 'sales']);
    Route::get('/reports/transactions', [\App\Http\Controllers\ReportController::class, 'transactions']);

    // Dashboard
    Route::get('/dashboard/summary', [DashboardController::class, 'summary']);
    Route::get('/dashboard/trend', [DashboardController::class, 'trend']);
    Route::get('/dashboard/top-products', [DashboardController::class, 'topProducts']);
    Route::get('/dashboard/busy-days', [DashboardController::class, 'busyDays']);
    Route::get('/dashboard/busy-hours', [DashboardController::class, 'busyHours']);

    // ML
    Route::get('/ml/forecast', [MlController::class, 'forecast']);
    Route::get('/ml/classification', [MlController::class, 'classification']);
    Route::get('/ml/bundling', [MlController::class, 'bundling']);
    Route::get('/ml/evaluation', [MlController::class, 'evaluation']);

    // Business Profile
    Route::get('/business-profile', [BusinessProfileController::class, 'show']);
    Route::put('/business-profile', [BusinessProfileController::class, 'update']);
});
