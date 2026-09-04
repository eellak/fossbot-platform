#!/usr/bin/env python3
"""Train a PC-hosted PilotNet-style steering and throttle model."""

from __future__ import annotations

import argparse
import csv
import json
import random
from pathlib import Path

import numpy as np
import torch
from PIL import Image, ImageEnhance
from torch import nn
from torch.utils.data import DataLoader, Dataset

from model import DrivingModel
from preprocessing import COLOR_CHANNELS, open_image, preprocess_image


def load_sessions(root: Path):
    sessions = []
    for csv_path in sorted(root.glob("*/samples.csv")):
        with csv_path.open(newline="", encoding="utf-8") as source:
            rows = list(csv.DictReader(source))
        samples = [
            {
                **row,
                "path": csv_path.parent / row["image"],
                "session": csv_path.parent.name,
            }
            for row in rows
            if (csv_path.parent / row["image"]).is_file()
        ]
        if samples:
            sessions.append(samples)
    return sessions


class DrivingDataset(Dataset):
    def __init__(self, samples, color_space, augment=False):
        self.samples = samples
        self.color_space = color_space
        self.augment = augment

    def __len__(self):
        return len(self.samples)

    def __getitem__(self, index):
        sample = self.samples[index]
        image = open_image(sample["path"])
        steering = float(sample["steering"])
        throttle = float(sample["throttle"])

        if self.augment:
            image = ImageEnhance.Brightness(image).enhance(random.uniform(0.75, 1.25))
            if random.random() < 0.5:
                image = image.transpose(Image.Transpose.FLIP_LEFT_RIGHT)
                steering = -steering

        tensor = torch.from_numpy(preprocess_image(image, self.color_space))
        controls = torch.tensor([steering, throttle], dtype=torch.float32)
        return tensor, controls


def split_sessions(sessions, validation_fraction, seed):
    rng = random.Random(seed)
    sessions = list(sessions)
    rng.shuffle(sessions)
    if len(sessions) == 1:
        samples = sessions[0]
        cut = max(1, round(len(samples) * (1 - validation_fraction)))
        return samples[:cut], samples[cut:] or samples[-1:]
    validation_count = max(1, round(len(sessions) * validation_fraction))
    validation = [item for session in sessions[:validation_count] for item in session]
    training = [item for session in sessions[validation_count:] for item in session]
    return training, validation


def metrics(predictions, targets):
    difference = predictions - targets
    return {
        "steering_mae": difference[:, 0].abs().mean().item(),
        "throttle_mae": difference[:, 1].abs().mean().item(),
        "steering_rmse": difference[:, 0].square().mean().sqrt().item(),
        "throttle_rmse": difference[:, 1].square().mean().sqrt().item(),
    }


def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument("--data-dir", type=Path, default=Path("data"))
    parser.add_argument("--output", type=Path, default=Path("models/driving-model.pt"))
    parser.add_argument("--color-space", choices=COLOR_CHANNELS, default="yuv")
    parser.add_argument("--epochs", type=int, default=25)
    parser.add_argument("--batch-size", type=int, default=64)
    parser.add_argument("--learning-rate", type=float, default=1e-4)
    parser.add_argument("--validation-fraction", type=float, default=0.2)
    parser.add_argument("--throttle-loss-weight", type=float, default=0.4)
    parser.add_argument("--seed", type=int, default=42)
    return parser.parse_args()


def main():
    args = parse_args()
    random.seed(args.seed)
    np.random.seed(args.seed)
    torch.manual_seed(args.seed)

    sessions = load_sessions(args.data_dir)
    if not sessions:
        raise SystemExit(f"No sessions found below {args.data_dir}")
    if sum(map(len, sessions)) < 10:
        raise SystemExit("Collect at least 10 samples before training")
    training, validation = split_sessions(sessions, args.validation_fraction, args.seed)
    print(f"Training samples: {len(training)}; validation samples: {len(validation)}")

    train_loader = DataLoader(
        DrivingDataset(training, args.color_space, augment=True),
        batch_size=args.batch_size,
        shuffle=True,
        num_workers=2,
        pin_memory=torch.cuda.is_available(),
    )
    validation_loader = DataLoader(
        DrivingDataset(validation, args.color_space),
        batch_size=args.batch_size,
        num_workers=2,
    )

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    model = DrivingModel(COLOR_CHANNELS[args.color_space]).to(device)
    optimizer = torch.optim.Adam(model.parameters(), lr=args.learning_rate)
    loss_function = nn.SmoothL1Loss(reduction="none")
    best_loss = float("inf")
    args.output.parent.mkdir(parents=True, exist_ok=True)

    for epoch in range(1, args.epochs + 1):
        model.train()
        train_loss = 0.0
        for images, controls in train_loader:
            images, controls = images.to(device), controls.to(device)
            optimizer.zero_grad(set_to_none=True)
            losses = loss_function(model(images), controls)
            loss = losses[:, 0].mean() + args.throttle_loss_weight * losses[:, 1].mean()
            loss.backward()
            optimizer.step()
            train_loss += loss.item() * len(images)

        model.eval()
        validation_loss = 0.0
        all_predictions, all_targets = [], []
        with torch.no_grad():
            for images, controls in validation_loader:
                images, controls = images.to(device), controls.to(device)
                predictions = model(images)
                losses = loss_function(predictions, controls)
                loss = losses[:, 0].mean() + args.throttle_loss_weight * losses[:, 1].mean()
                validation_loss += loss.item() * len(images)
                all_predictions.append(predictions.cpu())
                all_targets.append(controls.cpu())

        train_loss /= len(training)
        validation_loss /= len(validation)
        result = metrics(torch.cat(all_predictions), torch.cat(all_targets))
        print(
            f"epoch {epoch:02d} train={train_loss:.5f} val={validation_loss:.5f} "
            f"steer_mae={result['steering_mae']:.4f} throttle_mae={result['throttle_mae']:.4f}"
        )

        if validation_loss < best_loss:
            best_loss = validation_loss
            torch.save(
                {
                    "model_state": model.state_dict(),
                    "color_space": args.color_space,
                    "input_channels": COLOR_CHANNELS[args.color_space],
                    "metrics": result,
                    "validation_loss": validation_loss,
                    "training_samples": len(training),
                    "validation_samples": len(validation),
                    "config": vars(args) | {"data_dir": str(args.data_dir), "output": str(args.output)},
                },
                args.output,
            )

    print(f"Best model saved to {args.output}")
    print(json.dumps(torch.load(args.output, map_location="cpu", weights_only=False)["metrics"], indent=2))


if __name__ == "__main__":
    main()
