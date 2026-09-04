#!/usr/bin/env python3
"""Evaluate a trained model against recorded sessions without moving the robot."""

from __future__ import annotations

import argparse
from pathlib import Path

import torch
from torch.utils.data import DataLoader

from model import DrivingModel
from train import DrivingDataset, load_sessions, metrics


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--model", type=Path, required=True)
    parser.add_argument("--data-dir", type=Path, default=Path("data"))
    parser.add_argument("--batch-size", type=int, default=64)
    args = parser.parse_args()

    checkpoint = torch.load(args.model, map_location="cpu", weights_only=False)
    model = DrivingModel(checkpoint["input_channels"])
    model.load_state_dict(checkpoint["model_state"])
    model.eval()

    samples = [item for session in load_sessions(args.data_dir) for item in session]
    if not samples:
        raise SystemExit(f"No samples found below {args.data_dir}")
    loader = DataLoader(
        DrivingDataset(samples, checkpoint["color_space"]),
        batch_size=args.batch_size,
        num_workers=2,
    )

    predictions, targets = [], []
    with torch.no_grad():
        for images, controls in loader:
            predictions.append(model(images))
            targets.append(controls)
    result = metrics(torch.cat(predictions), torch.cat(targets))
    print(f"Samples: {len(samples)}")
    for name, value in result.items():
        print(f"{name}: {value:.6f}")


if __name__ == "__main__":
    main()
