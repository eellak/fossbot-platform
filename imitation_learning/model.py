"""Compact PilotNet-style model for steering and throttle regression."""

from __future__ import annotations

import torch
from torch import nn


class DrivingModel(nn.Module):
    def __init__(self, input_channels: int = 3):
        super().__init__()
        self.features = nn.Sequential(
            nn.Conv2d(input_channels, 24, kernel_size=5, stride=2),
            nn.ELU(),
            nn.Conv2d(24, 36, kernel_size=5, stride=2),
            nn.ELU(),
            nn.Conv2d(36, 48, kernel_size=5, stride=2),
            nn.ELU(),
            nn.Conv2d(48, 64, kernel_size=3),
            nn.ELU(),
            nn.Conv2d(64, 64, kernel_size=3),
            nn.ELU(),
            nn.Flatten(),
        )
        with torch.no_grad():
            feature_count = self.features(torch.zeros(1, input_channels, 66, 200)).shape[1]
        self.controller = nn.Sequential(
            nn.Linear(feature_count, 100),
            nn.ELU(),
            nn.Dropout(0.2),
            nn.Linear(100, 50),
            nn.ELU(),
            nn.Linear(50, 10),
            nn.ELU(),
            nn.Linear(10, 2),
            nn.Tanh(),
        )

    def forward(self, images):
        return self.controller(self.features(images))
